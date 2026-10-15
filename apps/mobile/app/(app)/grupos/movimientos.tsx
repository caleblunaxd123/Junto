import React from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { formatMoney } from '@junto/shared/currency';
import { api } from '../../../src/lib/api';
import { useGrupo } from '../../../src/hooks/useGrupos';
import { Screen, Button, Card, ErrorBox, Label, palette, design } from '../../../src/components/ui/Design';
import DateTimePicker from '../../../src/components/ui/ExpenseDatePicker';
import { dayLabel } from '../../../src/lib/statement';
import { historyChangeLines, historyStatus, type HistoryEntry, type HistoryPage } from '../../../src/lib/groupHistory';
import { errorMessage } from '../../../src/lib/errorMessage';

export default function Movements() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const group = useGrupo(grupoId);
  const [search, setSearch] = React.useState('');
  const [queryText, setQueryText] = React.useState('');
  const [tipo, setTipo] = React.useState('todos');
  const [desde, setDesde] = React.useState('');
  const [hasta, setHasta] = React.useState('');
  const [calendar, setCalendar] = React.useState<'desde' | 'hasta' | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  React.useEffect(() => { const timer = setTimeout(() => setQueryText(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const invalidRange = !!desde && !!hasta && desde > hasta;
  const query = useInfiniteQuery<HistoryPage>({
    queryKey: ['movimientos', grupoId, queryText, tipo, desde, hasta], initialPageParam: null,
    queryFn: ({ pageParam }) => api.get(`/grupos/${grupoId}/movimientos`, { params: { buscar: queryText, tipo, desde: desde || undefined, hasta: hasta || undefined, cursor: pageParam || undefined, zona: Intl.DateTimeFormat().resolvedOptions().timeZone } }).then(r => r.data),
    getNextPageParam: page => page.siguiente ?? undefined,
    enabled: !!grupoId && !invalidRange,
  });
  const { refetch } = query;
  useFocusEffect(React.useCallback(() => { if (!invalidRange) void refetch(); }, [refetch, invalidRange]));
  const rows = query.data?.pages.flatMap(p => p.movimientos) ?? [];
  const names = new Map(group.data?.resumen.cuentas.map(p => [p.usuarioId, p.nombre]) ?? []);
  const moneda = group.data?.moneda ?? 'PEN';
  function open(row: HistoryEntry) {
    if (row.tipo === 'cambio') setExpanded(expanded === row.clave ? null : row.clave);
    else router.push(row.tipo === 'gasto' ? `/(app)/gastos/${row.id}` : `/(app)/pagos/${row.id}`);
  }
  return <Screen back title="Movimientos y cambios" subtitle={group.data?.nombre ?? 'Cuentas del grupo'} refreshing={query.isRefetching} onRefresh={() => { if (!invalidRange) void refetch(); }}>
    <View style={[design.input, { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 }]}>
      <Ionicons name="search-outline" size={20} color={palette.muted} />
      <TextInput accessibilityLabel="Buscar por persona o concepto" placeholder="Persona o concepto…" placeholderTextColor={palette.muted} value={search} onChangeText={setSearch} maxLength={100} style={{ flex: 1, minHeight: 48, fontFamily: 'Jakarta', color: palette.ink }} />
      {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" onPress={() => setSearch('')} style={{ minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={20} color={palette.muted} /></Pressable>}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {([['todos', 'Todos'], ['gastos', 'Gastos'], ['pagos', 'Pagos'], ['cambios', 'Cambios']] as const).map(([value, label]) => <Button key={value} compact title={label} secondary={tipo !== value} onPress={() => setTipo(value)} />)}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button compact secondary title={desde ? `Desde ${dayLabel(desde)}` : 'Desde cualquier fecha'} onPress={() => setCalendar('desde')} />
      <Button compact secondary title={hasta ? `Hasta ${dayLabel(hasta)}` : 'Hasta cualquier fecha'} onPress={() => setCalendar('hasta')} />
      {(!!desde || !!hasta) && <Button compact secondary title="Quitar fechas" onPress={() => { setDesde(''); setHasta(''); }} />}
    </View>
    {calendar && <DateTimePicker mode="date" value={new Date(`${(calendar === 'desde' ? desde : hasta) || new Date().toISOString().slice(0, 10)}T12:00:00`)} onChange={(_event, value) => {
      setCalendar(null);
      if (!value) return;
      const day = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
      if (calendar === 'desde') setDesde(day); else setHasta(day);
    }} />}
    <Label size={12} color={palette.muted}>Busca en todo el historial. Gastos y pagos se filtran por su fecha; los cambios, por el día en que se registraron. Se muestran primero los registros más recientes.</Label>
    {invalidRange ? <ErrorBox message="La fecha inicial debe ser anterior o igual a la final." /> : query.isLoading ? <ActivityIndicator color={palette.primary} /> : query.isError ? <><ErrorBox message={errorMessage(query.error, 'No pudimos cargar los movimientos.')} /><Button title="Reintentar" onPress={() => refetch()} /></> : <>
      {!rows.length && <Card><Label weight="bold">No hay movimientos con estos filtros</Label><Label size={13} color={palette.muted}>Prueba otro nombre, concepto o rango de fechas.</Label></Card>}
      {rows.map(row => {
        const changes = historyChangeLines(row.detalle, moneda, names);
        const isChange = row.tipo === 'cambio';
        return <Pressable key={row.clave} accessibilityRole="button" accessibilityLabel={`${dayLabel(row.fecha)}. ${row.titulo}. ${row.texto}. ${row.monto !== null ? formatMoney(row.monto, moneda) : 'Cambio registrado'}. ${historyStatus(row)}`} onPress={() => open(row)}>
          <Card style={{ gap: 6, backgroundColor: isChange ? '#FFF8E1' : 'white', borderColor: isChange ? '#EADDAF' : palette.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name={isChange ? 'create-outline' : row.tipo === 'pago' ? 'swap-horizontal-outline' : 'receipt-outline'} size={18} color={isChange ? '#8A5A00' : palette.primary} />
              <Label size={12} color={palette.muted} style={{ flex: 1 }}>{dayLabel(row.fecha)} · {isChange ? 'Cambio' : row.tipo === 'pago' ? 'Pago' : 'Gasto'}</Label>
              {row.monto !== null && <Label size={17} weight="extra">{formatMoney(row.monto, moneda)}</Label>}
            </View>
            <Label weight="bold">{row.titulo}</Label>
            <Label size={13} color={palette.muted}>{row.texto}{isChange ? ` · ${new Date(row.fechaRegistro).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}` : ''}</Label>
            {!!historyStatus(row) && <Label size={12} weight="bold" color={row.estado === 'exitoso' ? palette.positive : '#8A5A00'}>{historyStatus(row)}</Label>}
            {isChange && changes.length > 0 && <Label size={12} weight="bold" color="#8A5A00">{expanded === row.clave ? 'Ocultar detalle' : 'Ver qué cambió'} ›</Label>}
            {expanded === row.clave && changes.map((line, i) => <Label key={i} size={13}>{line}</Label>)}
          </Card>
        </Pressable>;
      })}
      {query.hasNextPage && <Button secondary title="Ver movimientos anteriores" loading={query.isFetchingNextPage} onPress={() => query.fetchNextPage()} />}
    </>}
    <Label size={11} color={palette.muted}>Las correcciones se registran desde que esta función está disponible. Un comprobante se consulta dentro del pago, según tus permisos.</Label>
  </Screen>;
}
