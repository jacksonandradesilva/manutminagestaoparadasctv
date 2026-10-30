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

function getTimestampFromRecordDate(item, timeValue, isEnd = false) {
  const minutes = parseTimeToMinutes(timeValue);
  if (minutes === null) {
    return Number.NaN;
  }

  const dateText = String(item.dataHoraRegistro || item.dataHoraCadastro || '').trim();
  const brazilianDate = dateText.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  const isoDate = dateText.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const day = brazilianDate ? Number(brazilianDate[1]) : isoDate ? Number(isoDate[3]) : NaN;
  const month = brazilianDate ? Number(brazilianDate[2]) : isoDate ? Number(isoDate[2]) : NaN;
  const year = brazilianDate ? Number(brazilianDate[3]) : isoDate ? Number(isoDate[1]) : NaN;

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return Number.NaN;
  }

  const date = new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return Number.NaN;
  }

  const recordTime = dateText.match(/,?\s*(\d{2}):(\d{2})/);
  const recordMinutes = recordTime ? (Number(recordTime[1]) * 60) + Number(recordTime[2]) : null;

  if (!isEnd && recordMinutes !== null && minutes > recordMinutes) {
    date.setDate(date.getDate() - 1);
  } else if (isEnd && parseTimeToMinutes(item.horaInicio) > minutes) {
    date.setDate(date.getDate() + 1);
  }

  return date.getTime();
}

function getEndTimestampFromStart(startMs, startTime, endTime) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) {
    return Number.NaN;
  }

  const date = new Date(startMs);
  date.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
  if (endMinutes < startMinutes) {
    date.setDate(date.getDate() + 1);
  }
  return date.getTime();
}

export function getOngoingDurationMilliseconds(item, nowMs = Date.now()) {
  if (String(item.horaFim || '').trim() || Number.isFinite(Date.parse(item.fimTimestamp))) {
    return null;
  }

  const startMs = Number.isFinite(Date.parse(item.inicioTimestamp))
    ? Date.parse(item.inicioTimestamp)
    : getTimestampFromRecordDate(item, item.horaInicio);

  return Number.isFinite(startMs) ? Math.max(0, nowMs - startMs) : null;
}

export function getDurationInMinutes(item, nowMs = Date.now()) {
  const startMs = Date.parse(item.inicioTimestamp);
  const endMs = Date.parse(item.fimTimestamp);

  if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
    return Math.floor((endMs - startMs) / 60000);
  }

  if (String(item.horaFim || '').trim()) {
    const derivedStartMs = Number.isFinite(startMs) ? startMs : getTimestampFromRecordDate(item, item.horaInicio);
    const derivedEndMs = Number.isFinite(endMs)
      ? endMs
      : Number.isFinite(derivedStartMs)
        ? getEndTimestampFromStart(derivedStartMs, item.horaInicio, item.horaFim)
        : getTimestampFromRecordDate(item, item.horaFim, true);

    if (Number.isFinite(derivedStartMs) && Number.isFinite(derivedEndMs) && derivedEndMs >= derivedStartMs) {
      return Math.floor((derivedEndMs - derivedStartMs) / 60000);
    }
  } else {
    const ongoingDurationMs = getOngoingDurationMilliseconds(item, nowMs);
    if (ongoingDurationMs !== null) {
      return Math.floor(ongoingDurationMs / 60000);
    }
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
