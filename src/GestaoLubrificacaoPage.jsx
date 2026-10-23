import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { fetchLubrificacoes } from './store';
import { formatDateTime } from './utils';

const EMPTY_FILTERS = {
  dataInicio: '',
  dataFim: '',
  painelLavra: '',
  equipamento: '',
  litrosMin: '',
  litrosMax: '',
  horasMin: '',
  horasMax: ''
};

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getHoras(item) {
  return Math.max(0, (new Date(item.fim) - new Date(item.inicio)) / 3600000);
}

function formatHoras(horas) {
  const minutos = Math.round(horas * 60);
  return `${Math.floor(minutos / 60)}h ${pad2(minutos % 60)}min`;
}

function formatNumero(value) {
  return Number(value).toFixed(1).replace('.', ',');
}

export default function GestaoLubrificacaoPage() {
  const [registros, setRegistros] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLubrificacoes()
      .then((data) => setRegistros(data))
      .catch((err) => setError(err?.message || 'Falha ao carregar registros.'))
      .finally(() => setLoading(false));
  }, []);

  function updateFilter(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  const paineis = useMemo(
    () => [...new Set(registros.map((r) => r.painelLavra).filter(Boolean))].sort(),
    [registros]
  );
  const equipamentos = useMemo(
    () => [...new Set(registros.map((r) => r.equipamento).filter(Boolean))].sort(),
    [registros]
  );

  const filtrados = useMemo(() => {
    const litrosMin = filters.litrosMin === '' ? null : Number(filters.litrosMin);
    const litrosMax = filters.litrosMax === '' ? null : Number(filters.litrosMax);
    const horasMin = filters.horasMin === '' ? null : Number(filters.horasMin);
    const horasMax = filters.horasMax === '' ? null : Number(filters.horasMax);

    return registros
      .filter((item) => {
        const dia = toDateKey(item.inicio);
        const litros = Number(item.litros) || 0;
        const horas = getHoras(item);

        if (filters.dataInicio && dia < filters.dataInicio) return false;
        if (filters.dataFim && dia > filters.dataFim) return false;
        if (filters.painelLavra && item.painelLavra !== filters.painelLavra) return false;
        if (filters.equipamento && item.equipamento !== filters.equipamento) return false;
        if (litrosMin !== null && litros < litrosMin) return false;
        if (litrosMax !== null && litros > litrosMax) return false;
        if (horasMin !== null && horas < horasMin) return false;
        if (horasMax !== null && horas > horasMax) return false;
        return true;
      })
      .sort((a, b) => new Date(b.inicio) - new Date(a.inicio));
  }, [registros, filters]);

  const totais = useMemo(() => ({
    litros: filtrados.reduce((sum, item) => sum + (Number(item.litros) || 0), 0),
    horas: filtrados.reduce((sum, item) => sum + getHoras(item), 0)
  }), [filtrados]);

  const resumoEquipamentos = useMemo(() => {
    const map = new Map();
    filtrados.forEach((item) => {
      const key = `${item.painelLavra}||${item.equipamento}`;
      const atual = map.get(key) || { painelLavra: item.painelLavra, equipamento: item.equipamento, registros: 0, litros: 0, horas: 0 };
      atual.registros += 1;
      atual.litros += Number(item.litros) || 0;
      atual.horas += getHoras(item);
      map.set(key, atual);
    });
    return [...map.values()].sort((a, b) => b.litros - a.litros);
  }, [filtrados]);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <h1>Gestao de Lubrificacao</h1>
        </div>
        <img className="page-header-logo" src="/img/logo-header (1).png" alt="Logo" />
      </header>

      <div className="page-actions">
        <NavLink to="/" end className="btn-link">Voltar ao painel</NavLink>
      </div>

      <div className="filter-bar date-filter-bar">
        <div className="form-field">
          <label htmlFor="gl-data-inicio">Data inicio</label>
          <input id="gl-data-inicio" type="date" value={filters.dataInicio} onChange={(e) => updateFilter('dataInicio', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="gl-data-fim">Data fim</label>
          <input id="gl-data-fim" type="date" value={filters.dataFim} onChange={(e) => updateFilter('dataFim', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="gl-painel">Painel de lavra</label>
          <select id="gl-painel" value={filters.painelLavra} onChange={(e) => updateFilter('painelLavra', e.target.value)}>
            <option value="">Todos</option>
            {paineis.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="gl-equip">Equipamento</label>
          <select id="gl-equip" value={filters.equipamento} onChange={(e) => updateFilter('equipamento', e.target.value)}>
            <option value="">Todos</option>
            {equipamentos.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="gl-litros-min">Oleo minimo (L)</label>
          <input id="gl-litros-min" type="number" min="0" step="0.1" value={filters.litrosMin} onChange={(e) => updateFilter('litrosMin', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="gl-litros-max">Oleo maximo (L)</label>
          <input id="gl-litros-max" type="number" min="0" step="0.1" value={filters.litrosMax} onChange={(e) => updateFilter('litrosMax', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="gl-horas-min">Horas minimas</label>
          <input id="gl-horas-min" type="number" min="0" step="0.1" value={filters.horasMin} onChange={(e) => updateFilter('horasMin', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="gl-horas-max">Horas maximas</label>
          <input id="gl-horas-max" type="number" min="0" step="0.1" value={filters.horasMax} onChange={(e) => updateFilter('horasMax', e.target.value)} />
        </div>
        <button className="btn secundario" type="button" onClick={() => setFilters(EMPTY_FILTERS)}>Limpar filtros</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <div className="alert alert-info">Carregando registros...</div>}

      <p>
        <strong>Registros:</strong> {filtrados.length}
        {' | '}<strong>Total de oleo:</strong> {formatNumero(totais.litros)} L
        {' | '}<strong>Total de horas:</strong> {formatHoras(totais.horas)}
      </p>

      <h2>Resumo por painel e equipamento</h2>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Painel de lavra</th>
              <th>Equipamento</th>
              <th>Registros</th>
              <th>Oleo (L)</th>
              <th>Horas</th>
            </tr>
          </thead>
          <tbody>
            {resumoEquipamentos.length === 0 && !loading && (
              <tr><td colSpan="5">Nenhum registro para os filtros selecionados.</td></tr>
            )}
            {resumoEquipamentos.map((r) => (
              <tr key={`${r.painelLavra}-${r.equipamento}`}>
                <td>{r.painelLavra}</td>
                <td>{r.equipamento}</td>
                <td>{r.registros}</td>
                <td>{formatNumero(r.litros)}</td>
                <td>{formatHoras(r.horas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Registros detalhados</h2>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Painel de lavra</th>
              <th>Equipamento</th>
              <th>Lubrificador</th>
              <th>Turno</th>
              <th>Turma</th>
              <th>Inicio</th>
              <th>Fim</th>
              <th>Horas</th>
              <th>Oleo (L)</th>
              <th>Tipo de oleo</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && !loading && (
              <tr><td colSpan="10">Nenhum registro.</td></tr>
            )}
            {filtrados.map((item) => (
              <tr key={item.id}>
                <td>{item.painelLavra}</td>
                <td>{item.equipamento}</td>
                <td>{item.nomeLubrificador}</td>
                <td>{item.turno}</td>
                <td>{item.turma}</td>
                <td>{formatDateTime(new Date(item.inicio))}</td>
                <td>{formatDateTime(new Date(item.fim))}</td>
                <td>{formatHoras(getHoras(item))}</td>
                <td>{formatNumero(item.litros)}</td>
                <td>{item.tipoOleo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

