import { Filter, X } from 'lucide-react'
import './filtrosDespachos.css'
import {
  crearFiltrosIniciales,
  errorRangoFechas,
  hayFiltrosActivos,
  type FiltrosDespachos as ValoresFiltros,
} from './filtrosDespachos'

type Props = {
  filtros: ValoresFiltros
  onChange: (filtros: ValoresFiltros) => void
  cantidad: number
  total: number
}

export function ControlesFiltrosDespachos({ filtros, onChange, cantidad, total }: Props) {
  const error = errorRangoFechas(filtros)

  function cambiar<K extends keyof ValoresFiltros>(campo: K, valor: ValoresFiltros[K]) {
    onChange({ ...filtros, [campo]: valor })
  }

  return <div className="filters dispatch-filters" role="group" aria-label="Filtros de despachos">
    <div className="filter-title"><Filter size={15} /> Filtrar despachos</div>
    <label className="dispatch-filter" htmlFor="filtro-fondos">
      Estado de fondos
      <select id="filtro-fondos" value={filtros.estadoFondos} onChange={e => cambiar('estadoFondos', e.target.value as ValoresFiltros['estadoFondos'])}>
        <option value="todos">Todos los estados</option>
        <option value="disponibles">Disponibles</option>
        <option value="no_disponibles">No disponibles</option>
        <option value="pendiente_confirmacion">Pendientes de confirmar</option>
      </select>
    </label>
    <label className="dispatch-filter" htmlFor="filtro-nivel">
      Nivel de urgencia
      <select id="filtro-nivel" value={filtros.nivel} onChange={e => cambiar('nivel', e.target.value as ValoresFiltros['nivel'])}>
        <option value="todos">Todos los niveles</option>
        <option value="fondos_confirmados">Fondos confirmados</option>
        <option value="seguimiento">En seguimiento</option>
        <option value="atencion">Atención</option>
        <option value="urgente">Urgente</option>
        <option value="anulado">Anulado</option>
      </select>
    </label>
    <label className="dispatch-filter" htmlFor="filtro-periodo">
      Fecha límite
      <select id="filtro-periodo" value={filtros.periodo} onChange={e => onChange({ ...filtros, periodo: e.target.value as ValoresFiltros['periodo'], desde: '', hasta: '' })}>
        <option value="todas">Todas las fechas</option>
        <option value="proximos">Próximos 15 días</option>
        <option value="vencidos">Vencidos</option>
        <option value="rango">Rango personalizado</option>
      </select>
    </label>
    <label className="dispatch-filter" htmlFor="filtro-desde">
      Desde
      <input id="filtro-desde" type="date" value={filtros.desde} aria-invalid={Boolean(error)} aria-describedby={error ? 'error-rango-fechas' : undefined} onChange={e => onChange({ ...filtros, periodo: 'rango', desde: e.target.value })} />
    </label>
    <label className="dispatch-filter" htmlFor="filtro-hasta">
      Hasta
      <input id="filtro-hasta" type="date" value={filtros.hasta} aria-invalid={Boolean(error)} aria-describedby={error ? 'error-rango-fechas' : undefined} onChange={e => onChange({ ...filtros, periodo: 'rango', hasta: e.target.value })} />
    </label>
    {error && <p id="error-rango-fechas" className="filter-range-error" role="alert">{error}</p>}
    <div className="filter-actions">
      <span className="result-count" role="status">{cantidad} de {total} despachos</span>
      <button type="button" className="button button-outline" disabled={!hayFiltrosActivos(filtros) && filtros.periodo === 'todas'} onClick={() => onChange(crearFiltrosIniciales())}>
        <X size={15} /> Limpiar filtros
      </button>
    </div>
  </div>
}
