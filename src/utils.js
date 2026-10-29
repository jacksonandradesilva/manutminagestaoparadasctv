export function formatDateTime(date) {
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };

  return new Intl.DateTimeFormat('pt-BR', options).format(date);
}

export function formatDateOnly(date) {
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };

  return new Intl.DateTimeFormat('pt-BR', options).format(date);
}

export function parseTimeToMinutes(timeValue) {
  if (!timeValue || !timeValue.includes(':')) {
    return null;
  }

  const [hoursText, minutesText] = timeValue.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return (hours * 60) + minutes;
}

// Converte HH:MM em ISO usando a data de referencia; horario futuro (inicio) volta um dia, passado (fim) segue na data atual.
export function buildTimestampFromTime(timeValue, reference = new Date(), isEnd = false) {
  const minutes = parseTimeToMinutes(timeValue);
  if (minutes === null) {
    return undefined;
  }

  const date = new Date(reference);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (!isEnd && date.getTime() > reference.getTime()) {
    date.setDate(date.getDate() - 1);
  }
  return date.toISOString();
}

export function getDurationInMinutes(item) {
  const startMs = Date.parse(item.inicioTimestamp);
  const endMs = Date.parse(item.fimTimestamp);

  if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
    return Math.floor((endMs - startMs) / 60000);
  }

  const startMinutes = parseTimeToMinutes(item.horaInicio);
  const endMinutes = parseTimeToMinutes(item.horaFim);

  if (startMinutes === null || endMinutes === null) {
    return 0;
  }

  if (endMinutes >= startMinutes) {
    return endMinutes - startMinutes;
  }

  return (24 * 60) - startMinutes + endMinutes;
}

export function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`;
}

export function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}
