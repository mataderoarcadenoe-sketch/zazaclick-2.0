import re

file_path = r"c:\Users\Administrador\Desktop\API WPS\frontend-client\src\pages\Dashboard.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. HERO WELCOME CARD
content = content.replace(
    'className="p-6 sm:p-8 bg-white dark:bg-[#0D131F] rounded-3xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6"',
    'className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-[#0D131F] dark:to-[#131B2E] rounded-3xl relative overflow-hidden border border-slate-700/30 dark:border-slate-700/20 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6"'
)
content = content.replace(
    '<h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">',
    '<h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">'
)
content = content.replace(
    '<p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed font-normal">',
    '<p className="text-xs sm:text-sm text-slate-300 dark:text-slate-400 max-w-xl leading-relaxed font-normal">'
)

# 2. HEADERS
# Instances
h_inst_old = """<div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Instancias y Conexiones WhatsApp</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Crea nuevas conexiones de API o escanea el código QR para vincular tus líneas.</p>
                </div>"""
h_inst_new = """<div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
                    <Smartphone size={24} className="text-white" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Instancias y Conexiones WhatsApp</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Crea nuevas conexiones de API o escanea el código QR para vincular tus líneas.</p>
                  </div>
                </div>"""
content = content.replace(h_inst_old, h_inst_new)

# Playground
h_play_old = """<div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Tester Interactivo de API</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Prueba el envío de Texto, Multimedia, Notas de Voz PTT, Ubicación y Contactos.</p>
                </div>"""
h_play_new = """<div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25 shrink-0">
                    <Terminal size={24} className="text-white" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Tester Interactivo de API</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Prueba el envío de Texto, Multimedia, Notas de Voz PTT, Ubicación y Contactos.</p>
                  </div>
                </div>"""
content = content.replace(h_play_old, h_play_new)

# Docs
h_docs_old = """<div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Documentación de la API REST</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Integra el envío y recepción de WhatsApp en tu software mediante llamadas HTTP estándar con <code className="text-emerald-600 dark:text-emerald-400 font-bold">x-api-key</code>.</p>
                </div>"""
h_docs_new = """<div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                    <LayoutGrid size={24} className="text-white" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Documentación de la API REST</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Integra el envío y recepción de WhatsApp en tu software mediante llamadas HTTP estándar con <code className="text-emerald-600 dark:text-emerald-400 font-bold">x-api-key</code>.</p>
                  </div>
                </div>"""
content = content.replace(h_docs_old, h_docs_new)

# Subscription
h_subs_old = """<div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Planes y Licencia Activa</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Consulta los detalles de tu plan contratado, límites de cuota y fechas de vigencia.</p>
                </div>"""
h_subs_new = """<div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
                    <CreditCard size={24} className="text-white" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Planes y Licencia Activa</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Consulta los detalles de tu plan contratado, límites de cuota y fechas de vigencia.</p>
                  </div>
                </div>"""
content = content.replace(h_subs_old, h_subs_new)

# 3. INSTANCE CARDS
content = content.replace(
    'className="p-6 bg-white dark:bg-[#0D131F] rounded-3xl space-y-5 text-left transition-all"',
    'className="p-6 bg-white dark:bg-[#0D131F] rounded-3xl space-y-5 text-left border border-slate-100 dark:border-slate-800/50 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300"'
)

# 4. TABLE/SECTION CONTAINERS (except KPI and others)
# Since KPI cards don't use this class string (they use bg-gradient), this replace is safe for other generic cards.
content = content.replace(
    'bg-white dark:bg-[#0D131F] rounded-3xl',
    'bg-white dark:bg-[#0D131F] rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm'
)

# 5. PLAYGROUND SECTION
content = content.replace(
    'focus:outline-none focus:bg-slate-200 dark:focus:bg-[#1A253A]',
    'focus:outline-none focus:bg-white dark:focus:bg-[#0D131F] focus:ring-2 focus:ring-violet-500/30 focus:border-transparent border border-transparent dark:border-slate-700/50 transition-all'
)
content = content.replace(
    'pre className="p-5 bg-slate-100 dark:bg-[#070B12] text-emerald-600 dark:text-emerald-400 rounded-3xl text-xs font-mono overflow-x-auto"',
    'pre className="p-5 bg-slate-100 dark:bg-[#070B12] text-emerald-600 dark:text-emerald-400 rounded-3xl text-xs font-mono overflow-x-auto border-2 border-violet-500/20 dark:border-violet-500/10 shadow-inner"'
)

# 6. SUBSCRIPTION SECTION
# Target specifically the one inside planes y suscripcion after the replacement in step 4
content = re.sub(
    r'({\s*\/\*\s*PLANES Y SUSCRIPCIÓN\s*\*\/[\s\S]*?)(className="p-6 sm:p-8 bg-white dark:bg-\[#0D131F\] rounded-3xl border border-slate-100 dark:border-slate-800\/50 shadow-sm space-y-6")',
    r'\1className="p-6 sm:p-8 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-[#16120C] dark:to-[#18110B] rounded-3xl space-y-6 border border-amber-200/50 dark:border-amber-900/30 shadow-xl shadow-amber-500/10"',
    content
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Modification done!")
