import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { formatMinutes } from './utils';

export default function DowntimeTimelineChart({ data }) {
  return (
    <div className="downtime-timeline-chart" role="img" aria-label="Grafico de linha das horas de parada por data">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 20, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
          <XAxis
            dataKey="data"
            minTickGap={20}
            tickFormatter={(value) => `${value.slice(8, 10)}/${value.slice(5, 7)}`}
            stroke="var(--text-secondary)"
          />
          <YAxis
            width={72}
            tickFormatter={(value) => formatMinutes(value)}
            stroke="var(--text-secondary)"
          />
          <Tooltip
            content={({ active, payload }) => {
              const ponto = payload?.[0]?.payload;
              if (!active || !ponto) {
                return null;
              }

              const [ano, mes, dia] = ponto.data.split('-');
              return (
                <div className="downtime-timeline-tooltip">
                  <strong>{`${dia}/${mes}/${ano}`}</strong>
                  <span>{`Total: ${formatMinutes(ponto.minutos)} em ${ponto.quantidade} paradas`}</span>
                  <ul>
                    {ponto.horarios.map((horario, index) => (
                      <li key={`${horario.inicio}-${horario.fim}-${index}`}>
                        {`${horario.inicio} - ${horario.fim}${horario.equipamento ? ` | ${horario.equipamento}` : ''}`}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="minutos"
            name="Duracao"
            stroke="var(--primary)"
            strokeWidth={3}
            dot={{ r: 4, fill: 'var(--primary)' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
