import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { NavLink } from 'react-router-dom';
import { getState } from './store';
import { formatMinutes, getDurationInMinutes } from './utils';

function getDateKey(value) {
  const text = String(value || '').trim();
  const brazilianDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);

  if (brazilianDate) {
    return `${brazilianDate[3]}-${brazilianDate[2]}-${brazilianDate[1]}`;
  }

  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return isoDate ? isoDate[1] : '';
}

function getEventDate(item) {
  return getDateKey(item?.dataHoraRegistro || item?.dataHoraCadastro);
}

function getRecordedDowntime(item) {
  if (!String(item?.horaInicio || '').trim() || !String(item?.horaFim || '').trim()) {
    return 0;
  }

  return getDurationInMinutes(item);
}

function getAsset(item, index) {
  const tag = String(item?.tagEquipamento || '').trim();
  const name = String(item?.nome || '').trim();
  const id = item?.equipamentoId ?? item?.id;
  const key = tag ? `tag:${tag.toLowerCase()}` : name ? `nome:${name.toLowerCase()}` : id != null ? `id:${id}` : `sem-identificacao:${index}`;

  return {
    key,
    tag,
    name,
    label: tag ? `${tag}${name ? ` - ${name}` : ''}` : name || 'Equipamento sem identificacao'
  };
}

function getPeriodDays(start, end) {
  if (!start || !end || start > end) {
    return 0;
  }

  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  const startTime = Date.UTC(startYear, startMonth - 1, startDay);
  const endTime = Date.UTC(endYear, endMonth - 1, endDay);

  return Math.floor((endTime - startTime) / 86400000) + 1;
}

function formatHours(hours) {
  if (!Number.isFinite(hours)) {
    return '-';
  }

  return `${hours.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
}

function formatMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
    .format(new Date(year, month - 1, 1));

  return label.replace('.', '');
}

export default function MaintenanceMetricsDashboard() {
  const [equipamentos, setEquipamentos] = useState([]);
  const [historicoParadas, setHistoricoParadas] = useState([]);
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [tagFiltro, setTagFiltro] = useState('');
  const [supervisorFiltro, setSupervisorFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const state = await getState();

        if (!active) {
          return;
        }

        setEquipamentos(Array.isArray(state.equipamentos) ? state.equipamentos : []);
        setHistoricoParadas(Array.isArray(state.historicoParadas) ? state.historicoParadas : []);
      } catch (loadError) {
        if (active) {
          setError(loadError?.message || 'Nao foi possivel carregar os indicadores de manutencao.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const ativos = useMemo(() => {
    const uniqueAssets = new Map();

    [...equipamentos, ...historicoParadas].forEach((item, index) => {
      const asset = getAsset(item, index);
      const current = uniqueAssets.get(asset.key);
      uniqueAssets.set(asset.key, {
        ...asset,
        name: asset.name || current?.name || '',
        tag: asset.tag || current?.tag || '',
        label: asset.tag ? `${asset.tag}${asset.name ? ` - ${asset.name}` : ''}` : asset.name || current?.label || asset.label
      });
    });

    return [...uniqueAssets.values()].sort((first, second) => first.label.localeCompare(second.label, 'pt-BR'));
  }, [equipamentos, historicoParadas]);

  const datasDisponiveis = useMemo(() => {
    return historicoParadas
      .map(getEventDate)
      .filter(Boolean)
      .sort();
  }, [historicoParadas]);

  const supervisores = useMemo(() => {
    return [...new Set(
      historicoParadas
        .map((item) => String(item?.supervisor || '').trim())
        .filter(Boolean)
    )].sort((first, second) => first.localeCompare(second, 'pt-BR'));
  }, [historicoParadas]);

  const periodoInicial = dataInicial || datasDisponiveis[0] || '';
  const periodoFinal = dataFinal || datasDisponiveis[datasDisponiveis.length - 1] || '';
  const intervaloInvalido = Boolean(dataInicial && dataFinal && dataInicial > dataFinal);

  const paradasFiltradas = useMemo(() => {
    if (intervaloInvalido) {
      return [];
    }

    return historicoParadas.filter((item) => {
      const status = String(item?.status || '').trim().toLowerCase();
      if (status && status !== 'parado') {
        return false;
      }

      const dataRegistro = getEventDate(item);
      const atendeInicio = !dataInicial || (dataRegistro && dataRegistro >= dataInicial);
      const atendeFim = !dataFinal || (dataRegistro && dataRegistro <= dataFinal);
      const asset = getAsset(item, 0);
      const atendeSupervisor = !supervisorFiltro || String(item?.supervisor || '').trim() === supervisorFiltro;
      return atendeInicio && atendeFim && atendeSupervisor && (!tagFiltro || asset.key === tagFiltro);
    });
  }, [dataFinal, dataInicial, historicoParadas, intervaloInvalido, supervisorFiltro, tagFiltro]);

  const resumo = useMemo(() => {
    const chavesAtivosDaSupervisao = supervisorFiltro
      ? new Set([
        ...equipamentos
          .filter((item) => String(item?.supervisor || '').trim() === supervisorFiltro)
          .map((item, index) => getAsset(item, index).key),
        ...historicoParadas
          .filter((item) => String(item?.supervisor || '').trim() === supervisorFiltro)
          .map((item, index) => getAsset(item, index).key)
      ])
      : null;
    const ativosConsiderados = ativos.filter((asset) =>
      (!tagFiltro || asset.key === tagFiltro) &&
      (!chavesAtivosDaSupervisao || chavesAtivosDaSupervisao.has(asset.key))
    );
    const paradasComDuracao = paradasFiltradas.filter((item) => getRecordedDowntime(item) > 0).length;
    const minutosParados = paradasFiltradas.reduce((total, item) => total + getRecordedDowntime(item), 0);
    const dias = getPeriodDays(periodoInicial, periodoFinal);
    const horasObservadas = dias * 24 * ativosConsiderados.length;
    const horasOperacionais = Math.max(0, horasObservadas - (minutosParados / 60));
    const totalParadas = paradasFiltradas.length;
    const mttr = paradasComDuracao > 0 ? minutosParados / paradasComDuracao / 60 : null;
    const mtbf = totalParadas > 0 && horasObservadas > 0 ? horasOperacionais / totalParadas : null;

    return {
      ativosConsiderados,
      minutosParados,
      totalParadas,
      paradasComDuracao,
      mttr,
      mtbf,
      dias,
      horasOperacionais
    };
  }, [ativos, equipamentos, historicoParadas, paradasFiltradas, periodoFinal, periodoInicial, supervisorFiltro, tagFiltro]);

  const paradasPorAtivo = useMemo(() => {
    const grouped = new Map(resumo.ativosConsiderados.map((asset) => [
      asset.key,
      { ...asset, quantidade: 0, minutos: 0 }
    ]));

    paradasFiltradas.forEach((item, index) => {
      const asset = getAsset(item, index);
      const current = grouped.get(asset.key) || {
        ...asset,
        quantidade: 0,
        minutos: 0
      };
      current.quantidade += 1;
      current.minutos += getRecordedDowntime(item);
      if (getRecordedDowntime(item) > 0) {
        current.paradasComDuracao = (current.paradasComDuracao || 0) + 1;
      }
      grouped.set(asset.key, current);
    });

    const horasAtivasPorAtivo = resumo.dias * 24;

    return [...grouped.values()]
      .map((asset) => {
        const horasOperacionais = Math.max(0, horasAtivasPorAtivo - (asset.minutos / 60));
        return {
          ...asset,
          mttr: asset.paradasComDuracao > 0 ? asset.minutos / asset.paradasComDuracao / 60 : null,
          mtbf: asset.quantidade > 0 && horasAtivasPorAtivo > 0 ? horasOperacionais / asset.quantidade : null
        };
      })
      .sort((first, second) => second.minutos - first.minutos || first.label.localeCompare(second.label, 'pt-BR'));
  }, [paradasFiltradas, resumo.ativosConsiderados, resumo.dias]);

  const tendenciaMensal = useMemo(() => {
    const grouped = new Map();

    paradasFiltradas.forEach((item) => {
      const data = getEventDate(item);
      if (!data) {
        return;
      }

      const mes = data.slice(0, 7);
      grouped.set(mes, (grouped.get(mes) || 0) + getRecordedDowntime(item));
    });

    return [...grouped.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .slice(-12)
      .map(([mes, minutos]) => ({
        mes: formatMonth(mes),
        horas: Number((minutos / 60).toFixed(2))
      }));
  }, [paradasFiltradas]);

  function limparFiltros() {
    setDataInicial('');
    setDataFinal('');
    setTagFiltro('');
    setSupervisorFiltro('');
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <h1>Indicadores de Manutencao</h1>
          <p className="maintenance-dashboard-subtitle">Confiabilidade e disponibilidade dos ativos</p>
        </div>
        <img className="page-header-logo" src="/img/logo-header (1).png" alt="Logo" />
      </header>

      <div className="page-actions">
        <NavLink to="/" end className={({ isActive }) => `btn-link${isActive ? ' active-link' : ''}`}>
          Voltar ao painel principal
        </NavLink>
      </div>

      <section className="filter-bar date-filter-bar maintenance-dashboard-filters" aria-label="Filtros dos indicadores">
        <div className="form-field">
          <label htmlFor="maintenance-date-start">Data inicial</label>
          <input
            id="maintenance-date-start"
            type="date"
            value={dataInicial}
            max={dataFinal || undefined}
            onChange={(event) => setDataInicial(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="maintenance-date-end">Data final</label>
          <input
            id="maintenance-date-end"
            type="date"
            value={dataFinal}
            min={dataInicial || undefined}
            onChange={(event) => setDataFinal(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="maintenance-asset">Equipamento</label>
          <select id="maintenance-asset" value={tagFiltro} onChange={(event) => setTagFiltro(event.target.value)}>
            <option value="">Todos os equipamentos</option>
            {ativos.map((asset) => (
              <option key={asset.key} value={asset.key}>{asset.label}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="maintenance-supervisor">Supervisao</label>
          <select
            id="maintenance-supervisor"
            value={supervisorFiltro}
            onChange={(event) => setSupervisorFiltro(event.target.value)}
          >
            <option value="">Todas as supervisoes</option>
            {supervisores.map((supervisor) => (
              <option key={supervisor} value={supervisor}>{supervisor}</option>
            ))}
          </select>
        </div>
        <button className="btn secundario maintenance-filter-clear" type="button" onClick={limparFiltros}>
          Limpar filtros
        </button>
      </section>

      {intervaloInvalido && <div className="form-error">A data inicial deve ser anterior ou igual a data final.</div>}
      {loading && <div className="alert alert-info">Carregando indicadores de manutencao...</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && !error && (
        <>
          <section className="maintenance-metric-cards" aria-label="Indicadores de confiabilidade">
            <article className="maintenance-metric-card maintenance-metric-primary">
              <span>MTTR</span>
              <strong>{formatHours(resumo.mttr)}</strong>
              <small>Tempo medio para reparo</small>
            </article>
            <article className="maintenance-metric-card maintenance-metric-blue">
              <span>MTBF</span>
              <strong>{formatHours(resumo.mtbf)}</strong>
              <small>Tempo medio entre falhas</small>
            </article>
            <article className="maintenance-metric-card">
              <span>Paradas</span>
              <strong>{resumo.totalParadas}</strong>
              <small>Ocorrencias no periodo</small>
            </article>
            <article className="maintenance-metric-card">
              <span>Tempo parado</span>
              <strong>{formatHours(resumo.minutosParados / 60)}</strong>
              <small>{formatMinutes(resumo.minutosParados)} acumulados</small>
            </article>
          </section>

          <section className="maintenance-chart-panel" aria-labelledby="maintenance-chart-title">
            <div className="supervisor-chart-heading">
              <div>
                <h2 id="maintenance-chart-title">Horas de parada por mes</h2>
                <p>Ultimos 12 meses com registros no periodo selecionado</p>
              </div>
              <span className="supervisor-chart-total">Ativos: {resumo.ativosConsiderados.length}</span>
            </div>
            {tendenciaMensal.length > 0 ? (
              <div className="maintenance-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tendenciaMensal} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--text-secondary)" />
                    <YAxis width={52} stroke="var(--text-secondary)" />
                    <Tooltip formatter={(value) => [`${Number(value).toLocaleString('pt-BR')} h`, 'Tempo parado']} />
                    <Bar dataKey="horas" name="Tempo parado" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">Nenhuma parada encontrada para os filtros selecionados.</div>
            )}
          </section>

          <section className="maintenance-table-panel" aria-labelledby="maintenance-assets-title">
            <div className="supervisor-chart-heading">
              <div>
                <h2 id="maintenance-assets-title">Indicadores por equipamento</h2>
                <p>Comparativo de ocorrencias e tempos medios no periodo selecionado</p>
              </div>
            </div>
            <div className="maintenance-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Equipamento</th>
                    <th>Paradas</th>
                    <th>Tempo parado</th>
                    <th>MTTR</th>
                    <th>MTBF</th>
                  </tr>
                </thead>
                <tbody>
                  {paradasPorAtivo.map((asset) => (
                    <tr key={asset.key}>
                      <td data-label="Equipamento">{asset.label}</td>
                      <td data-label="Paradas">{asset.quantidade}</td>
                      <td data-label="Tempo parado">{formatMinutes(asset.minutos)}</td>
                      <td data-label="MTTR">{formatHours(asset.mttr)}</td>
                      <td data-label="MTBF">{formatHours(asset.mtbf)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {paradasPorAtivo.length === 0 && (
                <div className="empty-state">Cadastre equipamentos e registre paradas para visualizar os indicadores.</div>
              )}
            </div>
          </section>

          <p className="maintenance-metric-note">
            Calculo: MTTR = tempo parado registrado / paradas com inicio e fim; MTBF = (horas do periodo x equipamentos considerados - tempo parado registrado) / paradas.
            O periodo conta 24 horas por dia para cada equipamento, e a data usada e a do registro da parada.
            So entram no tempo parado registros com horarios de inicio e fim preenchidos.
          </p>
          {resumo.paradasComDuracao < resumo.totalParadas && (
            <div className="alert alert-info">
              {resumo.totalParadas - resumo.paradasComDuracao} parada(s) sem inicio ou fim nao entram no MTTR e no tempo parado registrado; o MTBF pode ficar superestimado.
            </div>
          )}
        </>
      )}
    </main>
  );
}
