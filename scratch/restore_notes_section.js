const fs = require('fs');

const path = 'c:/Users/Administrador/Desktop/API WPS/frontend-client/src/pages/Dashboard.tsx';

let content = fs.readFileSync(path, 'utf8');

const targetStr = '{/* Notas del contacto */}\r\n                                  </div>';
const targetStrLF = '{/* Notas del contacto */}\n                                  </div>';

const replacement = `{/* Notas del contacto */}
                                  <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800/80 space-y-3.5">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Notas del contacto</h5>
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          setNewNoteText('');
                                          setShowNotesFloatingWindow(true);
                                        }}
                                        className="px-2.5 py-0.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-[9px] font-bold rounded-full transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer shadow-sm flex items-center gap-1"
                                      >
                                        {clientNotes.length > 0 ? (
                                          <span>Ver notas ({clientNotes.length})</span>
                                        ) : (
                                          <>
                                            <span className="font-extrabold">+</span>
                                            <span>Agregar nota</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                    
                                    {clientNotes.length > 0 ? (
                                      <div className="bg-white dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
                                        <p className="text-[10px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium pr-1">
                                          {clientNotes[0].content}
                                        </p>
                                        <div className="text-[8px] text-slate-400 dark:text-slate-500 text-right mt-2.5 font-bold flex items-center justify-between">
                                          <span className="flex items-center gap-1.5">
                                            <span className="w-4 h-4 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[8px] font-extrabold flex items-center justify-center">
                                              {clientNotes[0].agent_name?.charAt(0).toUpperCase() || 'A'}
                                            </span>
                                            <span>{clientNotes[0].agent_name || 'Asesor'}</span>
                                          </span>
                                          <span>{new Date(clientNotes[0].created_at).toLocaleDateString('es-ES')}</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-2 italic font-medium">
                                        Sin notas registradas.
                                      </p>
                                    )}
                                  </div>`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacement);
  console.log("Success: Restored using CRLF version!");
} else if (content.includes(targetStrLF)) {
  content = content.replace(targetStrLF, replacement);
  console.log("Success: Restored using LF version!");
} else {
  // Let's do a more robust find
  const searchIndex = content.indexOf('{/* Notas del contacto */}');
  if (searchIndex !== -1) {
    const nextCloseDivIndex = content.indexOf('</div>', searchIndex);
    if (nextCloseDivIndex !== -1) {
      const originalBlock = content.substring(searchIndex, nextCloseDivIndex + '</div>'.length);
      content = content.replace(originalBlock, replacement);
      console.log("Success: Restored using substring search!");
    } else {
      console.log("Error: Could not find closing div after comment!");
    }
  } else {
    console.log("Error: Could not find '{/* Notas del contacto */}' comment!");
  }
}

fs.writeFileSync(path, content, 'utf8');
