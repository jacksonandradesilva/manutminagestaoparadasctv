import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { getState } from './store';
import { formatMinutes, getDurationInMinutes } from './utils';

function getRecordDateKey(value) {
  const text = String(value || '').trim();
  const brazilianDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);

  if (brazilianDate) {
    return `${brazilianDate[3]}-${brazilianDate[2]}-${brazilianDate[1]}`;
  }

  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return isoDate ? isoDate[1] : '';
}

function getMonthLabel(date) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
}

function formatHours(minutes) {
  return `${(minutes / 60).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
}

function getEquipment(item) {
  const tag = String(item?.tagEquipamento || '').trim();
  const name = String(item?.nome || '').trim();
  return {
    key: tag ? `tag:${tag.toLowerCase()}` : name ? `nome:${name.toLowerCase()}` : 'sem-identificacao',
    label: tag && name ? `${name} (${tag})` : tag || name || 'Nao informado'
  };
}

function ComparisonMetric({ label, current, previous, max, formatValue, currentLabel, previousLabel }) {
  return (
    <div className="monthly-comparison-metric">
      <h3>{label}</h3>
      {[{ label: previousLabel, value: previous, className: 'previous' }, { label: currentLabel, value: current, className: 'current' }].map((period) => (
        <div className="monthly-comparison-period" key={period.className}>
          <span>{period.label}</span>
          <div
            className={`monthly-comparison-track monthly-comparison-track-${period.className}`}
            role="img"
            aria-label={`${period.label}: ${formatValue(period.value)}`}
          >
            <div
              className="monthly-comparison-bar"
              style={{ width: `${max > 0 ? (period.value / max) * 100 : 0}%` }}
            />
          </div>
          <strong>{formatValue(period.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function MonthlySupervisorComparisonPage() {
  const [historicoParadas, setHistoricoParadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const state = await getState();
        if (active) {
          setHistoricoParadas(Array.isArray(state.historicoParadas) ? state.historicoParadas : []);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError?.message || 'Nao foi possivel carregar o historico de paradas.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadHistory();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const now = new Date(nowMs);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const daysInPreviousMonth = previousMonthEnd.getDate();
  const currentDay = now.getDate();
  const currentLabel = getMonthLabel(currentMonthStart);
  const currentPeriodLabel = `${currentLabel} ate hoje`;
  const previousLabel = getMonthLabel(previousMonthStart);
  const currentStartKey = `${currentMonthStart.getFullYear()}-${String(currentMonthStart.getMonth() + 1).padStart(2, '0')}-01`;
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const previousStartKey = `${previousMonthStart.getFullYear()}-${String(previousMonthStart.getMonth() + 1).padStart(2, '0')}-01`;
  const previousEndKey = `${previousMonthEnd.getFullYear()}-${String(previousMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(previousMonthEnd.getDate()).padStart(2, '0')}`;

  const comparison = useMemo(() => {
    const supervisorGroups = new Map();
    const equipmentGroups = new Map();
    const totals = {
      current: { quantidade: 0, minutos: 0 },
      previous: { quantidade: 0, minutos: 0 }
    };
    const dailyTotals = {
      current: new Map(),
      previous: new Map()
    };

    historicoParadas.forEach((item) => {
      const dateKey = getRecordDateKey(item?.dataHoraRegistro);
      const period = dateKey >= currentStartKey && dateKey <= todayKey
        ? 'current'
        : dateKey >= previousStartKey && dateKey <= previousEndKey
          ? 'previous'
          : '';

      if (!period) {
        return;
      }

      const supervisorName = String(item?.supervisor || '').trim() || 'Nao informado';
      const supervisorGroup = supervisorGroups.get(supervisorName) || {
        nome: supervisorName,
        current: { quantidade: 0, minutos: 0 },
        previous: { quantidade: 0, minutos: 0 }
      };
      const equipment = getEquipment(item);
      const equipmentGroup = equipmentGroups.get(equipment.key) || {
        key: equipment.key,
        nome: equipment.label,
        current: { quantidade: 0, minutos: 0 },
        previous: { quantidade: 0, minutos: 0 }
      };
      const minutos = getDurationInMinutes(item, nowMs);
      [supervisorGroup, equipmentGroup].forEach((group) => {
        group[period].quantidade += 1;
        group[period].minutos += minutos;
      });
      totals[period].quantidade += 1;
      totals[period].minutos += minutos;
      const day = Number(dateKey.slice(8, 10));
      dailyTotals[period].set(day, (dailyTotals[period].get(day) || 0) + minutos);
      supervisorGroups.set(supervisorName, supervisorGroup);
      equipmentGroups.set(equipment.key, equipmentGroup);
    });

    const sortGroups = (groups) => [...groups.values()].sort((first, second) =>
      (second.current.minutos + second.previous.minutos) - (first.current.minutos + first.previous.minutos) ||
      first.nome.localeCompare(second.nome, 'pt-BR')
    );
    const supervisoes = sortGroups(supervisorGroups);
    const equipamentos = sortGroups(equipmentGroups);

    return {
      supervisoes,
      equipamentos,
      totals,
      dailyTimeline: Array.from(
        { length: Math.max(daysInPreviousMonth, currentDay) },
        (_, index) => {
          const day = index + 1;
          return {
            dia: String(day),
            current: day <= currentDay ? dailyTotals.current.get(day) || 0 : null,
            previous: dailyTotals.previous.get(day) || 0
          };
        }
      ),
      maxSupervisorMinutes: Math.max(0, ...supervisoes.flatMap((item) => [item.current.minutos, item.previous.minutos])),
      maxSupervisorOccurrences: Math.max(0, ...supervisoes.flatMap((item) => [item.current.quantidade, item.previous.quantidade])),
      maxEquipmentMinutes: Math.max(0, ...equipamentos.flatMap((item) => [item.current.minutos, item.previous.minutos])),
      maxEquipmentOccurrences: Math.max(0, ...equipamentos.flatMap((item) => [item.current.quantidade, item.previous.quantidade]))
    };
  }, [currentDay, currentStartKey, daysInPreviousMonth, historicoParadas, nowMs, previousEndKey, previousStartKey, todayKey]);

  const periodLegend = (
    <div className="monthly-comparison-legend" aria-label="Legenda">
      <span><i className="monthly-comparison-swatch monthly-comparison-swatch-previous" />{previousLabel}</span>
      <span><i className="monthly-comparison-swatch monthly-comparison-swatch-current" />{currentPeriodLabel}</span>
    </div>
  );

  function renderComparisonGroups(groups, maxMinutes, maxOccurrences, emptyMessage) {
    if (groups.length === 0) {
      return <div className="empty-state">{emptyMessage}</div>;
    }

    return (
      <div className="monthly-comparison-list">
        {groups.map((item) => (
          <article className="monthly-comparison-card" key={item.key || item.nome}>
            <h3>{item.nome}</h3>
            <div className="monthly-comparison-metrics">
              <ComparisonMetric
                label="Horas paradas"
                current={item.current.minutos}
                previous={item.previous.minutos}
                max={maxMinutes}
                formatValue={formatHours}
                currentLabel={currentPeriodLabel}
                previousLabel={previousLabel}
              />
              <ComparisonMetric
                label="Ocorrencias"
                current={item.current.quantidade}
                previous={item.previous.quantidade}
                max={maxOccurrences}
                formatValue={(value) => value.toLocaleString('pt-BR')}
                currentLabel={currentPeriodLabel}
                previousLabel={previousLabel}
              />
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <h1>Comparativo Mensal por Supervisao e Equipamento</h1>
          <p className="maintenance-dashboard-subtitle">
            {currentLabel} ate hoje versus {previousLabel} completo
          </p>
        </div>
        <img className="page-header-logo" src="/img/logo-header (1).png" alt="Logo" />
      </header>

      <div className="page-actions">
        <NavLink to="/" end className={({ isActive }) => `btn-link${isActive ? ' active-link' : ''}`}>
          Voltar ao painel principal
        </NavLink>
      </div>

      {loading && <div className="alert alert-info">Carregando comparativo mensal...</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && !error && (
        <>
          <section className="summary-cards monthly-comparison-summary" aria-label="Resumo mensal">
            {[{ key: 'previous', label: previousLabel }, { key: 'current', label: currentPeriodLabel }].map((period) => (
              <article className="card" key={period.key}>
                <span>{period.label}</span>
                <strong>{formatHours(comparison.totals[period.key].minutos)}</strong>
                <small>{comparison.totals[period.key].quantidade} ocorrencias</small>
              </article>
            ))}
          </section>

          <section className="supervisor-chart" aria-labelledby="monthly-timeline-title">
            <div className="supervisor-chart-heading">
              <div>
                <h2 id="monthly-timeline-title">Linha do tempo das horas de parada</h2>
                <p>Comparacao diaria pelo dia do mes; os dias sem registros aparecem com valor zero.</p>
              </div>
            </div>
            <div className="monthly-comparison-legend monthly-comparison-timeline-legend" aria-label="Legenda da linha do tempo">
              <span><i className="monthly-comparison-swatch monthly-comparison-timeline-swatch-previous" />{previousLabel}</span>
              <span><i className="monthly-comparison-swatch monthly-comparison-timeline-swatch-current" />{currentPeriodLabel}</span>
            </div>
            <div className="monthly-comparison-timeline">
              <span className="monthly-comparison-watermark" aria-hidden="true">
                Comparativo Mensal por Supervisao e Equipamento
              </span>
              <div className="monthly-comparison-timeline-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={comparison.dailyTimeline} margin={{ top: 12, right: 20, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
                    <XAxis dataKey="dia" minTickGap={12} stroke="var(--text-secondary)" />
                    <YAxis width={72} tickFormatter={formatMinutes} stroke="var(--text-secondary)" />
                    <Tooltip
                      formatter={(value, name) => [formatHours(Number(value)), name]}
                      labelFormatter={(day) => `Dia ${day}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="previous"
                      name={previousLabel}
                      stroke="var(--primary-light)"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="current"
                      name={currentPeriodLabel}
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="supervisor-chart monthly-comparison-dark-panel" aria-labelledby="monthly-comparison-title">
            <div className="supervisor-chart-heading">
              <div>
                <h2 id="monthly-comparison-title">Comparacao de horas e ocorrencias por supervisao</h2>
                <p>O mes atual considera registros do primeiro dia ate hoje; o mes anterior considera o periodo completo.</p>
              </div>
            </div>

            {periodLegend}
            {renderComparisonGroups(
              comparison.supervisoes,
              comparison.maxSupervisorMinutes,
              comparison.maxSupervisorOccurrences,
              'Nenhuma parada encontrada nos periodos comparados.'
            )}
          </section>

          <section className="supervisor-chart monthly-comparison-dark-panel" aria-labelledby="monthly-equipment-comparison-title">
            <div className="supervisor-chart-heading">
              <div>
                <h2 id="monthly-equipment-comparison-title">Comparacao de horas e ocorrencias por equipamento</h2>
                <p>O mes atual considera registros do primeiro dia ate hoje; o mes anterior considera o periodo completo.</p>
              </div>
            </div>
            {periodLegend}
            {renderComparisonGroups(
              comparison.equipamentos,
              comparison.maxEquipmentMinutes,
              comparison.maxEquipmentOccurrences,
              'Nenhuma parada de equipamento encontrada nos periodos comparados.'
            )}
          </section>
        </>
      )}
    </main>
  );
}

