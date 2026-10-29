import { crearAplicacion } from './app.js'
import { cargarEntorno } from './config/entorno.js'
import { crearValidadorToken } from './servicios/autenticacion.js'
import { crearServicioDespachos } from './servicios/despachos.js'
import { crearServicioPerfiles } from './servicios/perfiles.js'

const entorno = cargarEntorno()

const aplicacion = crearAplicacion({
  validarToken: crearValidadorToken(
    entorno.supabaseUrl,
    entorno.supabasePublishableKey,
  ),
  obtenerPerfil: crearServicioPerfiles(
    entorno.supabaseUrl,
    entorno.supabasePublishableKey,
  ),
  despachos: crearServicioDespachos(
    entorno.supabaseUrl,
    entorno.supabasePublishableKey,
  ),
})

aplicacion.listen(entorno.puerto, () => {
  console.log(`API de Anticipa disponible en http://localhost:${entorno.puerto}`)
})
