import { StrictMode, type Dispatch, type FormEvent, type SetStateAction, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, BarChart3, Bell, CalendarDays, Check, ChevronDown, CircleDollarSign, CircleX, Clock3, FileText, History, LayoutDashboard, LogOut, Menu, Plus, RefreshCw, ShieldCheck, Sparkles, TrendingUp, Users, X } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ProveedorAutenticacion, useAutenticacion } from './autenticacion/AutenticacionContext'
import { RutaLogin, RutaProtegida } from './autenticacion/RutaProtegida'
import { clasificarErrorEdicion } from './edicionDespacho'
import { clasificarErrorFondos, ejecutarConIndicador } from './estadoFondos'
import { ControlesFiltrosDespachos } from './ControlesFiltrosDespachos'
import { crearFiltrosIniciales, errorRangoFechas, filtrarDespachos, hayFiltrosActivos } from './filtrosDespachos'
import {
  calcularAlertas,
  calcularIndicadores,
  diasRestantes,
  nivelDespacho,
  nivelMeta,
  textoDiasRestantes,
  type AlertaDespacho,
  type NivelOperacion,
} from './alertas'
import {
  anularDespacho,
  actualizarEstadoFondos,
  consultarHistorial,
  crearDespacho,
  editarDespacho,
  listarDespachos,
  listarImportadores,
  obtenerDespacho,
  type Despacho,
  type EstadoFondos,
  type HistorialDespacho,
  type ImportadorResumen,
  type NuevoDespacho,
} from './servicios/despachos'
import './styles.css'

const estadoFondosTexto: Record<EstadoFondos, string> = {
  disponibles: 'disponibles',
  no_disponibles: 'no disponibles',
  pendiente_confirmacion: 'pendiente de confirmar',
}
const formatMoney = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.'
}

function App() { return <Routes><Route path="/" element={<Landing />} /><Route path="/login" element={<RutaLogin><Login /></RutaLogin>} /><Route path="/despachante" element={<RutaProtegida rol="despachante"><Despachante /></RutaProtegida>} /><Route path="/importador" element={<RutaProtegida rol="importador"><Importador /></RutaProtegida>} /><Route path="*" element={<Navigate to="/" replace />} /></Routes> }

function Brand({ dark = false }: { dark?: boolean }) { return <Link className={`brand ${dark ? 'brand-dark' : ''}`} to="/"><span className="brand-mark"><span /></span><span>anticipa</span></Link> }
function Landing() { return <div className="landing"><nav className="landing-nav container"><Brand dark /><div className="nav-links"><a href="#como-funciona">Cómo funciona</a><a href="#planes">Planes</a><Link className="nav-login" to="/login">Ingresar <ArrowRight size={16} /></Link></div></nav><main><section className="hero"><div className="container hero-grid"><div className="hero-copy"><div className="eyebrow"><Sparkles size={14} /> coordinación inteligente para tu operación</div><h1>Anticipá el próximo movimiento.</h1><p>Reuní el monto, la fecha límite y el estado de los fondos de cada despacho en un mismo lugar.</p><div className="hero-actions"><Link className="button button-accent" to="/login">Ver demo <ArrowRight size={18} /></Link><a className="text-link" href="#como-funciona">Conocé cómo funciona <ArrowRight size={16} /></a></div><div className="hero-proof"><div className="avatar-stack"><span>MS</span><span>FA</span><span>GN</span></div><span>Más claridad para cada operación</span></div></div><div className="hero-visual"><div className="visual-glow" /><div className="dashboard-preview"><div className="preview-top"><span>Resumen de despachos</span><span className="live-dot">● En vivo</span></div><div className="preview-stat"><div><small>Fondos a reunir</small><strong>$ 13.263.000</strong></div><div className="stat-trend">↑ 12.5%<small>vs. mes anterior</small></div></div><div className="mini-bars">{[{h:45,label:'Lun 21',value:'$ 1,8M'},{h:65,label:'Mar 22',value:'$ 2,4M'},{h:52,label:'Mié 23',value:'$ 1,9M'},{h:85,label:'Jue 24',value:'$ 3,2M'},{h:58,label:'Vie 25',value:'$ 2,1M'},{h:72,label:'Lun 28',value:'$ 2,7M'},{h:48,label:'Mar 29',value:'$ 1,6M'}].map((bar,index)=><span key={bar.label} className={index===3?'bar-active':''} style={{height:`${bar.h}%`}} title={`${bar.label}: ${bar.value}`} />)}</div><div className="preview-footer"><span>Despachos activos</span><strong>24</strong><span className="footer-pill">3 requieren atención</span></div></div></div></div></section><section id="como-funciona" className="section-light"><div className="container"><div className="section-heading"><span className="section-kicker">simple por diseño</span><h2>Toda la operación, más clara.</h2><p>Un espacio compartido para que cada decisión llegue a tiempo.</p></div><div className="steps"><Step number="01" icon={<FileText size={20}/>} title="Cargá tus despachos" text="Centralizá cada operación y su fecha límite."/><Step number="02" icon={<CircleDollarSign size={20}/>} title="Informá tus fondos" text="Cada parte ve lo que necesita, cuando lo necesita."/><Step number="03" icon={<TrendingUp size={20}/>} title="Anticipá decisiones" text="Priorizá lo urgente y operá con previsibilidad."/></div></div></section><section id="planes" className="plans-section"><div className="container"><div className="section-heading centered"><span className="section-kicker">elegí tu forma de operar</span><h2>Planes para cada equipo.</h2><p>Empezá con una demo y encontrá el plan que mejor acompaña tu operación.</p></div><div className="plans"><Plan name="Esencial" price="Gratis" detail="Para empezar a ordenar tus despachos." features={['Hasta 10 despachos activos','Panel de seguimiento','Estado de fondos compartido']}/><Plan name="Operativo" price="$ 24.900" detail="Para equipos que necesitan más previsibilidad." features={['Despachos ilimitados','Alertas de vencimiento','Soporte prioritario']} featured/><Plan name="Equipo" price="$ 49.900" detail="Para operaciones con múltiples usuarios." features={['Todo lo del plan Operativo','Roles y permisos','Reportes de operación']}/></div></div></section></main><footer className="footer"><div className="container footer-inner"><Brand dark /><span>Coordinación inteligente para operaciones de comercio exterior.</span><div className="footer-links"><a href="#como-funciona">Cómo funciona</a><a href="#planes">Planes</a><Link to="/login">Ingresar</Link></div><small>© 2024 Anticipa. Todos los derechos reservados.</small></div></footer></div> }

function LandingLegacy() { return <div className="landing"><nav className="landing-nav container"><Brand dark /><div className="nav-links"><a href="#como-funciona">Cómo funciona</a><a href="#planes">Planes</a><Link className="nav-login" to="/login">Ingresar <ArrowRight size={16} /></Link></div></nav><main><section className="hero"><div className="container hero-grid"><div className="hero-copy"><div className="eyebrow"><Sparkles size={14} /> coordinación inteligente para tu operación</div><h1>Anticipá el próximo movimiento.</h1><p>Reuní el monto, la fecha límite y el estado de los fondos de cada despacho en un mismo lugar.</p><div className="hero-actions"><Link className="button button-accent" to="/login">Ver demo <ArrowRight size={18} /></Link><a className="text-link" href="#como-funciona">Conocé cómo funciona <ArrowRight size={16} /></a></div><div className="hero-proof"><div className="avatar-stack"><span>MS</span><span>FA</span><span>GN</span></div><span>Más claridad para cada operación</span></div></div><div className="hero-visual"><div className="visual-glow" /><div className="dashboard-preview"><div className="preview-top"><span>Resumen de despachos</span><span className="live-dot">● En vivo</span></div><div className="preview-stat"><div><small>Fondos a reunir</small><strong>$ 13.263.000</strong></div><div className="stat-trend">↑ 12.5%<small>vs. mes anterior</small></div></div><div className="mini-bars"><span style={{height:'45%'}} /><span style={{height:'65%'}} /><span style={{height:'52%'}} /><span className="bar-active" style={{height:'85%'}} /><span style={{height:'58%'}} /><span style={{height:'72%'}} /><span style={{height:'48%'}} /></div><div className="preview-footer"><span>Despachos activos</span><strong>24</strong><span className="footer-pill">3 requieren atención</span></div></div></div></div></section><section id="como-funciona" className="section-light"><div className="container"><div className="section-heading"><span className="section-kicker">simple por diseño</span><h2>Todo lo importante, <em>en un vistazo.</em></h2><p>Anticipa conecta a despachantes e importadores para que cada pago llegue a tiempo.</p></div><div className="steps"><Step number="01" icon={<FileText />} title="Cargá el despacho" text="Registrá el monto, la fecha límite y los datos clave de cada operación." /><Step number="02" icon={<CircleDollarSign />} title="Informá tus fondos" text="El importador actualiza su estado para que todos trabajen con la misma información." /><Step number="03" icon={<ShieldCheck />} title="Anticipá la urgencia" text="Visualizá qué operación necesita atención antes de que se reprograme." /></div></div></section><section id="planes" className="plans-section"><div className="container"><div className="section-heading"><span className="section-kicker">elegí tu ritmo</span><h2>Un plan para cada <em>operación.</em></h2><p>Los importadores son invitados sin cargo dentro de cualquier plan.</p></div><div className="plans"><Plan name="Básico" price="$ 18.000" detail="Para empezar a ordenar tus despachos." features={['Hasta 15 despachos activos / mes','1 usuario despachante','Tablero de fondos y urgencia']} /><Plan featured name="Profesional" price="$ 39.000" detail="Para equipos que quieren anticiparse." features={['Hasta 50 despachos activos / mes','Hasta 3 usuarios despachantes','Indicadores de riesgo','Soporte prioritario']} /><Plan name="Empresarial" price="A medida" detail="Para operaciones sin límites." features={['Despachos ilimitados','Usuarios ilimitados','Todas las funciones','Acompañamiento dedicado']} /></div></div></section></main><footer className="footer container"><Brand /><span>© 2024 Anticipa · Coordinación de pagos en despacho aduanero</span></footer></div> }
function Step({number,icon,title,text}: {number:string;icon:React.ReactNode;title:string;text:string}) { return <div className="step"><div className="step-top"><span className="step-number">{number}</span><span className="step-icon">{icon}</span></div><h3>{title}</h3><p>{text}</p></div> }
function Plan({name,price,detail,features,featured=false}:{name:string;price:string;detail:string;features:string[];featured?:boolean}) { return <div className={`plan ${featured?'plan-featured':''}`}>{featured&&<div className="popular">Más elegido</div>}<div className="plan-name">{name}</div><h3>{price}<small>{price.startsWith('$')?' / mes':''}</small></h3><p>{detail}</p><div className="plan-line" />{features.map(f=><div className="feature" key={f}><Check size={16}/>{f}</div>)}<Link className={`button ${featured?'button-dark':'button-outline'}`} to="/login">Empezar demo <ArrowRight size={16}/></Link></div> }

function Login() {
  const navigate = useNavigate()
  const { iniciarSesion, cargando, error: errorSesion } = useAutenticacion()
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null)

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorFormulario(null)

    try {
      const perfil = await iniciarSesion(email, contrasena)
      navigate(`/${perfil.rol}`, { replace: true })
    } catch (error) {
      setErrorFormulario(error instanceof Error ? error.message : 'No se pudo iniciar sesión.')
    }
  }

  return <div className="login-page"><div className="login-aside"><Brand dark /><div className="login-aside-copy"><span className="section-kicker">bienvenido a anticipa</span><h1>Más previsibilidad para tu operación.</h1><p>Ingresá con la cuenta asignada a tu empresa.</p><div className="quote"><div className="quote-mark">“</div><p>La información correcta, en el momento correcto, cambia toda la operación.</p></div></div><span className="aside-foot">Acceso protegido con Supabase Auth</span></div><div className="login-form-wrap"><Link className="back-link" to="/"><ArrowRight size={16} className="back-arrow"/> Volver al inicio</Link><form className="login-form" onSubmit={enviar}><span className="section-kicker">acceso seguro</span><h2>Ingresá a Anticipa</h2><p className="form-intro">Tu perfil determina automáticamente la vista habilitada.</p><label>Email<input type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="tu@email.com" /></label><label>Contraseña<div className="password-field"><input type="password" autoComplete="current-password" required value={contrasena} onChange={event=>setContrasena(event.target.value)} placeholder="••••••••" /></div></label>{(errorFormulario || errorSesion) && <div className="login-error" role="alert">{errorFormulario || errorSesion}</div>}<button type="submit" disabled={cargando} className="button button-accent full">{cargando ? 'Validando...' : 'Ingresar'} <ArrowRight size={18}/></button><div className="demo-note"><Sparkles size={15}/> El rol se obtiene del perfil autorizado</div></form></div></div>
}

function AlertasCampana({alertas}:{alertas:AlertaDespacho[]}) {
  const [abiertas,setAbiertas]=useState(false)
  return <div className="alerts-menu"><button className="icon-button" aria-label="Ver alertas vigentes" aria-expanded={abiertas} onClick={()=>setAbiertas(actual=>!actual)}><Bell size={19}/>{alertas.length>0&&<span className="notification">{alertas.length>9?'9+':alertas.length}</span>}</button>{abiertas&&<section className="alerts-popover" aria-label="Alertas vigentes"><header><div><strong>Alertas vigentes</strong><span>{alertas.length} {alertas.length===1?'despacho requiere':'despachos requieren'} atención</span></div><button aria-label="Cerrar alertas" onClick={()=>setAbiertas(false)}><X size={15}/></button></header>{alertas.length===0?<div className="alerts-empty"><Check size={18}/><span>No hay alertas vigentes.</span></div>:<div className="alerts-list">{alertas.map(alerta=><article key={alerta.despachoId}><AlertTriangle size={16}/><div><strong>{alerta.referencia} · {nivelMeta[alerta.nivel].label}</strong><span>{alerta.vencimientoTexto} · Fondos {estadoFondosTexto[alerta.estadoFondos]}</span></div></article>)}</div>}</section>}</div>
}

function AppShell({children, title, subtitle, current, alertas}:{children:React.ReactNode;title:string;subtitle:string;current:'dashboard'|'importador';alertas:AlertaDespacho[]}) {
  const navigate = useNavigate()
  const { perfil, cerrarSesion } = useAutenticacion()
  const iniciales = perfil?.nombreVisible.split(/\s+/).slice(0, 2).map(parte => parte[0]).join('').toUpperCase() || 'US'

  async function salir() {
    await cerrarSesion()
    navigate('/login', { replace: true })
  }

  return <div className="app-shell"><aside className="sidebar"><Brand /><div className="side-label">ESPACIO DE TRABAJO</div>{perfil?.rol==='despachante'&&<Link className={current==='dashboard'?'active':''} to="/despachante"><LayoutDashboard size={18}/> Panel general</Link>}{perfil?.rol==='importador'&&<Link className={current==='importador'?'active':''} to="/importador"><CircleDollarSign size={18}/> Mis despachos</Link>}<div className="sidebar-bottom"><div className="help-card"><Bell size={18}/><strong>¿Necesitás ayuda?</strong><span>Estamos para acompañarte.</span></div><button onClick={()=>void salir()}><LogOut size={17}/> Cerrar sesión</button></div></aside><main className="app-main"><header className="app-header"><div className="mobile-brand"><Brand /></div><div><div className="breadcrumb">Anticipa <span>/</span> {current==='dashboard'?'Panel general':'Mis despachos'}</div><h1>{title}</h1><p>{subtitle}</p></div><div className="header-user"><AlertasCampana alertas={alertas}/><div className="user-avatar">{iniciales}</div><div><strong>{perfil?.nombreVisible}</strong><small>{perfil?.rol === 'despachante' ? 'Despachante' : 'Importador'} · {perfil?.empresaDespachante.razonSocial}</small></div><ChevronDown size={16}/></div></header>{children}</main></div>
}
function Metric({label,value,detail,icon,accent}:{label:string;value:string;detail:string;icon:React.ReactNode;accent?:boolean}) { return <div className="metric"><div className={`metric-icon ${accent?'orange':''}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div> }
function UrgencyBadge({nivel}:{nivel:NivelOperacion}) { return <span className={`urgency ${nivel}`}>{nivel==='anulado'?<CircleX size={12} aria-hidden="true"/>:<i />}{nivelMeta[nivel].label}</span> }
function EstadoDatos({cargando,error,vacio,onReintentar}:{cargando:boolean;error:string|null;vacio:boolean;onReintentar:()=>void}) {
  if (cargando) return <div className="data-state">Cargando información...</div>
  if (error) return <div className="data-state error" role="alert"><span>{error}</span><button className="button button-outline" onClick={onReintentar}><RefreshCw size={14}/> Reintentar</button></div>
  if (vacio) return <div className="data-state">Todavía no hay despachos para mostrar.</div>
  return null
}

function DispatchTable({items,onFunds,onHistory,onEdit,onCancel,actualizando=new Set(),recuperando=new Set(),avisosFondos={},onRecuperarFondos}:{items:Despacho[];onFunds?: (id:string,estado:EstadoFondos)=>void;onHistory?: (despacho:Despacho)=>void;onEdit?: (despacho:Despacho)=>void;onCancel?: (despacho:Despacho)=>void;actualizando?:Set<string>;recuperando?:Set<string>;avisosFondos?:Record<string,{mensaje:string;recuperable:boolean}>;onRecuperarFondos?:(id:string)=>void}) {
  return <div className="table-card"><div className="table-wrap"><table><thead><tr><th>Despacho</th><th>Importador</th><th>Monto a reunir</th><th>Fecha límite</th><th>Días</th><th>Estado de fondos</th><th>Estado</th>{onHistory&&<th>Acciones</th>}</tr></thead><tbody>{items.map(d=>{const nivel=nivelDespacho(d);const dias=diasRestantes(d.fechaLimite);const aviso=avisosFondos[d.id];return <tr key={d.id}><td><strong className="ref">{d.referencia}</strong>{d.motivoAnulacion&&<small className="cancel-reason">Motivo: {d.motivoAnulacion}</small>}</td><td>{d.importador.razonSocial}</td><td><strong>{formatMoney(d.monto)}</strong></td><td><span className="due"><CalendarDays size={15}/>{fechaCalendario(d.fechaLimite)}</span></td><td><span className={dias<0?'overdue':''}>{textoDiasRestantes(dias)}</span></td><td><div className="funds-control">{onFunds&&!d.anuladoEn?<select value={d.estadoFondos} disabled={actualizando.has(d.id)||recuperando.has(d.id)} onChange={e=>onFunds(d.id,e.target.value as EstadoFondos)}><option value="disponibles">disponibles</option><option value="pendiente_confirmacion">pendiente de confirmar</option><option value="no_disponibles">no disponibles</option></select>:<span className="funds">{estadoFondosTexto[d.estadoFondos]}</span>}{aviso&&<div className="funds-notice" role="status"><span>{aviso.mensaje}</span>{aviso.recuperable&&onRecuperarFondos&&<button type="button" disabled={recuperando.has(d.id)} onClick={()=>onRecuperarFondos(d.id)}>{recuperando.has(d.id)?'Actualizando...':'Cargar datos actuales'}</button>}</div>}</div></td><td><UrgencyBadge nivel={nivel}/></td>{onHistory&&<td><div className="table-actions"><button className="table-action" onClick={()=>onHistory(d)}><History size={14}/> Historial</button>{!d.anuladoEn&&onEdit&&<button className="table-action" onClick={()=>onEdit(d)}>Editar</button>}{!d.anuladoEn&&onCancel&&<button className="table-action danger" onClick={()=>onCancel(d)}>Anular</button>}</div></td>}</tr>})}</tbody></table></div></div>
}

function Despachante() {
  const { sesion } = useAutenticacion()
  const token = sesion?.access_token
  const [despachos,setDespachos] = useState<Despacho[]>([])
  const [importadores,setImportadores] = useState<ImportadorResumen[]>([])
  const [cargando,setCargando] = useState(true)
  const [error,setError] = useState<string|null>(null)
  const [showModal,setShowModal] = useState(false)
  const [filtros,setFiltros] = useState(crearFiltrosIniciales)
  const [historialDe,setHistorialDe] = useState<Despacho|null>(null)
  const [historial,setHistorial] = useState<HistorialDespacho[]|null>(null)
  const [errorHistorial,setErrorHistorial] = useState<string|null>(null)
  const [editando,setEditando] = useState<Despacho|null>(null)
  const [anulando,setAnulando] = useState<Despacho|null>(null)
  const [aviso] = useState<string|null>(null)

  const cargarDatos = useCallback(async () => {
    if (!token) return
    setCargando(true)
    setError(null)
    try {
      const [operaciones,cartera] = await Promise.all([listarDespachos(token),listarImportadores(token)])
      setDespachos(operaciones)
      setImportadores(cartera)
    } catch (fallo) {
      setError(mensajeError(fallo))
    } finally {
      setCargando(false)
    }
  },[token])

  useEffect(()=>{void cargarDatos()},[cargarDatos])

  async function agregar(datos:NuevoDespacho) {
    if (!token) throw new Error('La sesión ya no está disponible.')
    const creado = await crearDespacho(token,datos)
    setDespachos(actuales=>[...actuales,creado].sort((a,b)=>a.fechaLimite.localeCompare(b.fechaLimite)))
    setShowModal(false)
  }

  async function abrirHistorial(despacho:Despacho) {
    if (!token) return
    setHistorialDe(despacho)
    setHistorial(null)
    setErrorHistorial(null)
    try {
      setHistorial(await consultarHistorial(token,despacho.id))
    } catch (fallo) {
      setErrorHistorial(mensajeError(fallo))
    }
  }

  async function guardarEdicion(datos:{versionEsperada:number;referencia:string;monto:number;fechaLimite:string}) {
    if (!token||!editando) return
    const actualizado=await editarDespacho(token,editando.id,datos)
    setDespachos(lista=>lista.map(d=>d.id===actualizado.id?actualizado:d))
    setEditando(null)
  }

  async function confirmarAnulacion(motivo:string) {
    if (!token||!anulando) return
    const actualizado=await anularDespacho(token,anulando.id,anulando.version,motivo)
    setDespachos(lista=>lista.map(d=>d.id===actualizado.id?actualizado:d))
    setAnulando(null)
  }

  const items=filtrarDespachos(despachos,filtros)
  const indicadores=calcularIndicadores(items)
  const activos=items.filter(d=>!d.anuladoEn)
  const anulados=items.length-indicadores.activos
  const filtrosActivos=hayFiltrosActivos(filtros)
  const errorFechas=errorRangoFechas(filtros)
  const chart=[
    {name:'Disponibles',value:indicadores.porEstadoFondos.disponibles,color:'#5d876c'},
    {name:'No disponibles',value:indicadores.porEstadoFondos.no_disponibles,color:'#d75e00'},
    {name:'Pendiente de confirmar',value:indicadores.porEstadoFondos.pendiente_confirmacion,color:'#F9A001'},
  ]
  const confirmados=indicadores.activos?Math.round(indicadores.porEstadoFondos.disponibles/indicadores.activos*100):0
  const hoy=new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date())

  return <AppShell current="dashboard" alertas={calcularAlertas(despachos)} title="Panel general" subtitle={hoy.charAt(0).toUpperCase()+hoy.slice(1)}>
    <div className="dispatch-panel">
    <div className="metrics">
      <Metric label="Despachos activos" value={String(indicadores.activos).padStart(2,'0')} detail={`${anulados} ${anulados===1?'anulado':'anulados'}${filtrosActivos?' en este resultado':''}`} icon={<FileText/>}/>
      <Metric label="Fondos a reunir" value={formatMoney(activos.reduce((total,d)=>total+d.monto,0)).replace('ARS','')} detail={filtrosActivos?'Resultado filtrado':'Cartera activa'} icon={<CircleDollarSign/>} accent/>
      <Metric label="En riesgo" value={String(indicadores.enRiesgo).padStart(2,'0')} detail={filtrosActivos?'Atención + Urgente del resultado':'Atención + Urgente'} icon={<AlertTriangle/>}/>
      <Metric label="Fondos confirmados" value={`${confirmados}%`} detail={filtrosActivos?'de los activos del resultado':'de la cartera activa'} icon={<TrendingUp/>}/>
    </div>
    {aviso&&<div className="operation-notice" role="status">{aviso} La lista ya fue actualizada.</div>}
    <div className="content-grid">
      <section>
        <div className="section-toolbar">
          <div><h2>Despachos recientes</h2><p>Seguimiento de tus operaciones guardadas</p></div>
          <div className="toolbar-actions">
            <button className="button button-outline" onClick={()=>void cargarDatos()} disabled={cargando}><RefreshCw size={16}/> Actualizar</button>
            <button className="button button-accent" onClick={()=>setShowModal(true)} disabled={!importadores.length}><Plus size={17}/> Cargar despacho</button>
          </div>
        </div>
        <ControlesFiltrosDespachos filtros={filtros} onChange={setFiltros} cantidad={items.length} total={despachos.length}/>
        <EstadoDatos cargando={cargando} error={error} vacio={!despachos.length} onReintentar={()=>void cargarDatos()}/>
        {!cargando&&!error&&despachos.length>0&&(
          items.length>0
            ? <DispatchTable items={items} onHistory={despacho=>void abrirHistorial(despacho)} onEdit={setEditando} onCancel={setAnulando}/>
            : <div className="data-state" role="status">
                <span>{errorFechas?'Revisá el rango de fechas para ver los despachos.':'No hay despachos que coincidan con los filtros.'}</span>
                <button type="button" className="button button-outline" onClick={()=>setFiltros(crearFiltrosIniciales())}>Mostrar todos los despachos</button>
              </div>
        )}
      </section>
      <section className="chart-card">
        <div className="card-title"><div><h2>Estado de fondos</h2><p>{filtrosActivos?'Distribución del resultado filtrado':'Distribución de la cartera activa'}</p></div></div>
        {indicadores.activos>0
          ? <div className="donut">
              <ResponsiveContainer width="100%" height={190}><PieChart><Pie data={chart} innerRadius={58} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">{chart.map(e=><Cell key={e.name} fill={e.color}/>)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
              <div className="donut-center"><strong>{indicadores.activos}</strong><span>activos</span></div>
            </div>
          : <div className="funds-distribution-empty">No hay despachos activos en este resultado.</div>}
        <div className="legend">{chart.map(e=><div key={e.name}><i style={{background:e.color}} />{e.name}<strong>{e.value}</strong></div>)}</div>
      </section>
    </div>
    {showModal&&<NewDispatch importadores={importadores} onClose={()=>setShowModal(false)} onAdd={agregar}/>}
    {editando&&<EditDispatch despacho={editando} onClose={()=>setEditando(null)} onSave={guardarEdicion}/>}
    {anulando&&<CancelDispatch despacho={anulando} onClose={()=>setAnulando(null)} onConfirm={confirmarAnulacion}/>}
    {historialDe&&<HistorialModal despacho={historialDe} eventos={historial} error={errorHistorial} onClose={()=>setHistorialDe(null)} onReintentar={()=>void abrirHistorial(historialDe)}/>}
    </div>
  </AppShell>
}

function NewDispatch({importadores,onClose,onAdd}:{importadores:ImportadorResumen[];onClose:()=>void;onAdd:(datos:NuevoDespacho)=>Promise<void>}) {
  const [form,setForm]=useState({referencia:'',importadorId:importadores[0]?.id??'',monto:'',fechaLimite:''})
  const [guardando,setGuardando]=useState(false)
  const [error,setError]=useState<string|null>(null)
  async function enviar(event:FormEvent<HTMLFormElement>){event.preventDefault();setGuardando(true);setError(null);try{await onAdd({referencia:form.referencia,importadorId:form.importadorId,monto:Number(form.monto),fechaLimite:form.fechaLimite})}catch(fallo){setError(mensajeError(fallo));setGuardando(false)}}
  return <div className="modal-backdrop"><div className="modal"><button className="close" onClick={onClose}><X size={19}/></button><span className="section-kicker">nueva operación</span><h2>Cargar despacho</h2><p>Seleccioná un importador ya autorizado para tu empresa.</p><form onSubmit={enviar}><label>Referencia<input required value={form.referencia} onChange={e=>setForm({...form,referencia:e.target.value})} placeholder="IMP-2026-0043" /></label><label>Importador<select required value={form.importadorId} onChange={e=>setForm({...form,importadorId:e.target.value})}>{importadores.map(importador=><option key={importador.id} value={importador.id}>{importador.razonSocial}</option>)}</select></label><div className="form-row"><label>Monto<input required min="0.01" step="0.01" type="number" value={form.monto} onChange={e=>setForm({...form,monto:e.target.value})} placeholder="0" /></label><label>Fecha límite<input required type="date" value={form.fechaLimite} onChange={e=>setForm({...form,fechaLimite:e.target.value})} /></label></div>{error&&<div className="form-error" role="alert">{error}</div>}<button disabled={guardando} className="button button-accent full">{guardando?'Guardando...':'Agregar despacho'} <ArrowRight size={17}/></button></form></div></div>
}

function EditDispatch({despacho,onClose,onSave}:{despacho:Despacho;onClose:()=>void;onSave:(datos:{versionEsperada:number;referencia:string;monto:number;fechaLimite:string})=>Promise<void>}) {
  const {sesion}=useAutenticacion()
  const [form,setForm]=useState({referencia:despacho.referencia,monto:String(despacho.monto),fechaLimite:despacho.fechaLimite})
  const [versionEsperada,setVersionEsperada]=useState(despacho.version)
  const [guardando,setGuardando]=useState(false)
  const [cargandoActuales,setCargandoActuales]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [hayConflicto,setHayConflicto]=useState(false)
  async function enviar(event:FormEvent<HTMLFormElement>){event.preventDefault();setGuardando(true);setError(null);setHayConflicto(false);try{await onSave({versionEsperada,referencia:form.referencia,monto:Number(form.monto),fechaLimite:form.fechaLimite})}catch(fallo){const resultado=clasificarErrorEdicion(fallo);setError(resultado.mensaje);setHayConflicto(resultado.tipo==='conflicto')}finally{setGuardando(false)}}
  async function cargarActuales(){const token=sesion?.access_token;if(!token){setError('La sesión ya no está disponible.');return}setCargandoActuales(true);try{const actual=await obtenerDespacho(token,despacho.id);setForm({referencia:actual.referencia,monto:String(actual.monto),fechaLimite:actual.fechaLimite});setVersionEsperada(actual.version);setHayConflicto(false);setError(null)}catch(fallo){setError(clasificarErrorEdicion(fallo).mensaje)}finally{setCargandoActuales(false)}}
  return <div className="modal-backdrop"><div className="modal"><button className="close" onClick={onClose}><X size={19}/></button><span className="section-kicker">editar operación</span><h2>{despacho.referencia}</h2><p>El importador permanece fijo: {despacho.importador.razonSocial}.</p><form onSubmit={enviar}><label>Referencia<input required value={form.referencia} onChange={e=>setForm({...form,referencia:e.target.value})}/></label><div className="form-row"><label>Monto<input required min="0.01" step="0.01" type="number" value={form.monto} onChange={e=>setForm({...form,monto:e.target.value})}/></label><label>Fecha límite<input required type="date" value={form.fechaLimite} onChange={e=>setForm({...form,fechaLimite:e.target.value})}/></label></div>{error&&<div className="form-error" role="alert">{error}</div>}{hayConflicto&&<button type="button" className="button button-outline full" disabled={cargandoActuales} onClick={()=>void cargarActuales()}>{cargandoActuales?'Cargando...':'Cargar datos actuales y volver a editar'}</button>}<button disabled={guardando||cargandoActuales} className="button button-accent full">{guardando?'Guardando...':'Guardar cambios'}</button></form></div></div>
}

function CancelDispatch({despacho,onClose,onConfirm}:{despacho:Despacho;onClose:()=>void;onConfirm:(motivo:string)=>Promise<void>}) {
  const [motivo,setMotivo]=useState('')
  const [confirmado,setConfirmado]=useState(false)
  const [guardando,setGuardando]=useState(false)
  const [error,setError]=useState<string|null>(null)
  async function enviar(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!motivo.trim()||!confirmado){setError('Indicá un motivo y confirmá la anulación.');return}setGuardando(true);setError(null);try{await onConfirm(motivo.trim())}catch(fallo){setError(mensajeError(fallo));setGuardando(false)}}
  return <div className="modal-backdrop"><div className="modal"><button className="close" onClick={onClose}><X size={19}/></button><span className="section-kicker">anular despacho</span><h2>{despacho.referencia}</h2><p>El despacho seguirá visible, pero ya no podrá editarse ni cambiar sus fondos.</p><form onSubmit={enviar}><label>Motivo<textarea required value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Explicá el motivo de la anulación" /></label><label className="confirmation"><input type="checkbox" checked={confirmado} onChange={e=>setConfirmado(e.target.checked)}/> Confirmo que deseo anular este despacho.</label>{error&&<div className="form-error" role="alert">{error}</div>}<button disabled={guardando} className="button button-danger full">{guardando?'Anulando...':'Anular despacho'}</button></form></div></div>
}

function fechaCalendario(valor:string):string {
  const partes=/^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : valor
}

function valorHistorial(campo:string,valor:unknown,despacho:Despacho):string {
  if (valor===null||valor===undefined) return 'Sin valor'
  if (campo==='estadoFondos'&&typeof valor==='string'&&valor in estadoFondosTexto) return estadoFondosTexto[valor as EstadoFondos]
  if (campo==='importadorId'&&valor===despacho.importador.id) return despacho.importador.razonSocial
  if (campo==='fechaLimite'&&typeof valor==='string') return fechaCalendario(valor)
  if (campo==='monto'&&(typeof valor==='number'||typeof valor==='string')&&!Number.isNaN(Number(valor))) return formatMoney(Number(valor))
  return String(valor)
}

const nombresCampos:Record<string,string>={referencia:'Referencia',importadorId:'Importador',monto:'Monto',fechaLimite:'Fecha límite',estadoFondos:'Estado de fondos',motivoAnulacion:'Motivo de anulación'}
const ordenCamposCreacion=['referencia','importadorId','monto','fechaLimite','estadoFondos']
const formatoFechaHoraArgentina=new Intl.DateTimeFormat('es-AR',{
  timeZone:'America/Argentina/Buenos_Aires',
  day:'2-digit',
  month:'2-digit',
  year:'numeric',
  hour:'2-digit',
  minute:'2-digit',
  second:'2-digit',
  hourCycle:'h23',
})

function fechaHoraArgentina(valor:string):string {
  const fecha=new Date(valor)
  return Number.isNaN(fecha.getTime()) ? valor : formatoFechaHoraArgentina.format(fecha)
}

function HistorialModal({despacho,eventos,error,onClose,onReintentar}:{despacho:Despacho;eventos:HistorialDespacho[]|null;error:string|null;onClose:()=>void;onReintentar:()=>void}) {
  return <div className="modal-backdrop"><div className="modal history-modal"><button className="close" onClick={onClose}><X size={19}/></button><span className="section-kicker">auditoría</span><h2>Historial de {despacho.referencia}</h2><p>Cada evento indica autor, fecha y los datos que quedaron guardados.</p>{eventos===null&&!error&&<div className="data-state">Cargando historial...</div>}{error&&<div className="data-state error"><span>{error}</span><button className="button button-outline" onClick={onReintentar}>Reintentar</button></div>}{eventos?.length===0&&<div className="data-state">No hay eventos registrados.</div>}<div className="history-list">{eventos?.map(evento=>{const esCreacion=evento.accion==='creado';const esAnulacion=evento.accion==='anulado';const cambios=esCreacion?[...evento.cambios].sort((a,b)=>ordenCamposCreacion.indexOf(a.campo)-ordenCamposCreacion.indexOf(b.campo)):evento.cambios;return <article key={evento.id} className="history-event"><header><div><strong>{esCreacion?'Despacho creado':esAnulacion?'Despacho anulado':'Despacho actualizado'}</strong><span>Por {evento.autor.nombreVisible} · Versión {evento.versionResultante}</span></div><time dateTime={evento.modificadoEn}>{fechaHoraArgentina(evento.modificadoEn)}</time></header>{esCreacion?<div className="history-initial">{cambios.map(cambio=><div key={`${evento.id}-${cambio.campo}`}><strong>{nombresCampos[cambio.campo]??cambio.campo}</strong><span>{valorHistorial(cambio.campo,cambio.nuevo,despacho)}</span></div>)}</div>:esAnulacion?<div className="history-cancel"><strong>Motivo</strong><span>{valorHistorial('motivoAnulacion',cambios.find(c=>c.campo==='motivoAnulacion')?.nuevo,despacho)}</span></div>:cambios.map(cambio=><div className="history-change" key={`${evento.id}-${cambio.campo}`}><strong>{nombresCampos[cambio.campo]??cambio.campo}</strong><span>{valorHistorial(cambio.campo,cambio.anterior,despacho)}</span><ArrowRight size={13}/><span>{valorHistorial(cambio.campo,cambio.nuevo,despacho)}</span></div>)}</article>})}</div></div></div>
}

function DistribucionFondos({datos}:{datos:{name:string;value:number;color:string}[]}) {
  const total=datos.reduce((suma,item)=>suma+item.value,0)
  if (!total) return <div className="funds-distribution-empty">No hay despachos activos para mostrar.</div>
  return <div className="funds-distribution">{datos.map(item=><div className="funds-distribution-row" key={item.name}><div className="funds-distribution-label"><span>{item.name}</span><strong>{item.value}</strong></div><div className="funds-distribution-track" aria-label={`${item.name}: ${item.value}`}><span style={{width:`${item.value/total*100}%`,background:item.color}} /></div></div>)}</div>
}

function Importador() {
  const { sesion }=useAutenticacion()
  const token=sesion?.access_token
  const [despachos,setDespachos]=useState<Despacho[]>([])
  const [cargando,setCargando]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [aviso,setAviso]=useState<string|null>(null)
  const [actualizando,setActualizando]=useState<Set<string>>(new Set())
  const [recuperando,setRecuperando]=useState<Set<string>>(new Set())
  const [avisosFondos,setAvisosFondos]=useState<Record<string,{mensaje:string;recuperable:boolean}>>({})

  const cargarDatos=useCallback(async()=>{if(!token)return;setCargando(true);setError(null);setAviso(null);try{setDespachos(await listarDespachos(token))}catch(fallo){setError(mensajeError(fallo))}finally{setCargando(false)}},[token])
  useEffect(()=>{void cargarDatos()},[cargarDatos])

  function cambiarIndicador(setter:Dispatch<SetStateAction<Set<string>>>,id:string,activo:boolean){setter(actual=>{const siguiente=new Set(actual);if(activo)siguiente.add(id);else siguiente.delete(id);return siguiente})}

  async function recuperarDespacho(id:string,mantenerAviso=false){if(!token)return;try{const actual=await ejecutarConIndicador(()=>obtenerDespacho(token,id),activo=>cambiarIndicador(setRecuperando,id,activo));setDespachos(lista=>lista.map(d=>d.id===id?actual:d));if(!mantenerAviso)setAvisosFondos(avisos=>{const siguientes={...avisos};delete siguientes[id];return siguientes})}catch(fallo){setAvisosFondos(avisos=>({...avisos,[id]:{mensaje:`No se pudieron cargar los datos actuales. ${clasificarErrorFondos(fallo).mensaje}`,recuperable:true}}))}}

  async function onFunds(id:string,estadoFondos:EstadoFondos){if(!token)return;const actual=despachos.find(d=>d.id===id);if(!actual)return;setError(null);setAviso(null);setAvisosFondos(avisos=>{const siguientes={...avisos};delete siguientes[id];return siguientes});try{const actualizado=await ejecutarConIndicador(()=>actualizarEstadoFondos(token,id,actual.version,estadoFondos),activo=>cambiarIndicador(setActualizando,id,activo));setDespachos(lista=>lista.map(d=>d.id===id?actualizado:d))}catch(fallo){const resultado=clasificarErrorFondos(fallo);setAvisosFondos(avisos=>({...avisos,[id]:{mensaje:resultado.mensaje,recuperable:resultado.tipo==='version'}}));if(resultado.tipo==='anulado')await recuperarDespacho(id,true)}}

  const indicadores=calcularIndicadores(despachos)
  const chart=[{name:'Disponibles',value:indicadores.porEstadoFondos.disponibles,color:'#5d876c'},{name:'No disponibles',value:indicadores.porEstadoFondos.no_disponibles,color:'#d75e00'},{name:'Pendientes',value:indicadores.porEstadoFondos.pendiente_confirmacion,color:'#F9A001'}]
  const ultima=despachos.reduce<string|null>((mayor,d)=>!mayor||d.actualizadoEn>mayor?d.actualizadoEn:mayor,null)
  return <AppShell current="importador" alertas={calcularAlertas(despachos)} title="Mis despachos" subtitle="Mantené actualizado el estado de tus fondos"><div className="importer-banner"><div className="banner-icon"><CircleDollarSign/></div><div><strong>Tu información ayuda a anticipar</strong><p>Actualizá el estado de tus fondos para que tu despachante pueda coordinar cada pago a tiempo.</p></div><span className="banner-date"><Clock3 size={15}/> Última actualización: {ultima?new Date(ultima).toLocaleString('es-AR'):'sin cambios'}</span></div>{aviso&&<div className="operation-notice" role="status">{aviso} La lista ya fue actualizada.</div>}<div className="content-grid importer-grid"><section><div className="section-toolbar"><div><h2>Operaciones asignadas</h2><p>{despachos.length} despachos guardados</p></div><button className="button button-outline" onClick={()=>void cargarDatos()} disabled={cargando}><RefreshCw size={16}/> Actualizar</button></div><EstadoDatos cargando={cargando} error={error} vacio={!despachos.length} onReintentar={()=>void cargarDatos()}/>{!cargando&&!error&&despachos.length>0&&<div className="importer-table"><DispatchTable items={despachos} onFunds={(id,estado)=>void onFunds(id,estado)} actualizando={actualizando} recuperando={recuperando} avisosFondos={avisosFondos} onRecuperarFondos={id=>void recuperarDespacho(id)}/></div>}</section><section className="chart-card"><div className="card-title"><div><h2>Estado de operaciones</h2><p>Tu panorama actual</p></div></div><DistribucionFondos datos={chart}/><div className="chart-note"><Check size={15}/> Los cambios quedan disponibles al volver a consultar</div></section></div></AppShell>
}

createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><ProveedorAutenticacion><App /></ProveedorAutenticacion></BrowserRouter></StrictMode>)
