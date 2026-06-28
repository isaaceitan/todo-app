/* @jsxRuntime classic */
const { useState, useEffect, useRef, useMemo } = React;

/* ----------------------------- Utilidades ----------------------------- */
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2));
const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const addDays = (d, n) => { const x = startOfDay(d); x.setDate(x.getDate()+n); return x; };
const iso = (d) => d ? new Date(d).toISOString() : null;
const isSameDay = (a,b) => a && b && startOfDay(a).getTime() === startOfDay(b).getTime();
const isToday = (d) => d && isSameDay(new Date(d), new Date());
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const fmt = (d, opt) => new Intl.DateTimeFormat('es-ES', opt).format(new Date(d));
const daysBetween = (d) => Math.floor((Date.now() - new Date(d)) / 86400000);

const AREA_PALETTE = [
  ['Trabajo','#4F8CFF'],['Familia','#34C77B'],['Comunidad','#A87BFF'],
  ['Finanzas','#FFB547'],['Salud','#FF6B8A'],['Casa','#5ED4D4'],
];
const CTX_PALETTE = [
  ['@oficina','#4F8CFF'],['@computadora','#A87BFF'],['@llamadas','#34C77B'],
  ['@errands','#FFB547'],['@casa','#FF6B8A'],
];
const RECURRENCE = [['none','No se repite'],['daily','Diario'],['weekly','Semanal'],['monthly','Mensual']];
const COLOR_OPTS = ['#4F8CFF','#34C77B','#A87BFF','#FFB547','#FF6B8A','#5ED4D4','#FF6B6B','#F7B731','#45AAF2','#78E08F','#FD9644','#A55EEA'];

/* ----------------------------- Datos de ejemplo ----------------------------- */
function seed() {
  const areas = AREA_PALETTE.map(([name,color]) => ({ id: uid(), name, color }));
  const contexts = CTX_PALETTE.map(([name,color]) => ({ id: uid(), name, color }));
  const A = (n) => areas.find(a => a.name === n)?.id;
  const C = (n) => contexts.find(c => c.name === n)?.id;
  const projects = [
    { id: uid(), name: 'Dashboard ventas', outcome: 'Dashboard en producción', areaId: A('Trabajo'), status: 'active' },
    { id: uid(), name: 'Plan de integración comunitaria', areaId: A('Comunidad'), status: 'active' },
    { id: uid(), name: 'Vacaciones familia diciembre', areaId: A('Familia'), status: 'active' },
  ];
  const tasks = []; const events = [];
  const today = startOfDay(new Date());
  const T = (o) => {
    const t = Object.assign({ id: uid(), title:'', outcome:null, nextAction:null, projectId:null, contextId:null,
      areaId:null, dueDate:null, recurrence:'none', status:'active', isWaitingFor:false, waitingFrom:null,
      isQuickWin:false, isSomeday:false, createdAt: iso(new Date()), completedAt:null, deletedAt:null }, o);
    tasks.push(t); events.push({ id: uid(), taskId: t.id, type:'created', detail:'Tarea creada', timestamp: t.createdAt });
    return t;
  };
  T({ title:'Revisar PR del módulo de inventario', areaId:A('Trabajo'), contextId:C('@computadora'), dueDate: iso(today) });
  T({ title:'Llamar al banco sobre la transferencia', areaId:A('Finanzas'), contextId:C('@llamadas'), dueDate: iso(today), isQuickWin:true });
  T({ title:'Confirmar cita con el dentista', areaId:A('Salud'), contextId:C('@llamadas'), dueDate: iso(today), isQuickWin:true });
  T({ title:'Mandar reportes diarios', areaId:A('Trabajo'), dueDate: iso(today), status:'completed', completedAt: iso(new Date()) });
  const projTasks = (p, total, done, area) => {
    for (let i=1;i<=total;i++) T({ title:`${p.name} – tarea ${i}`, areaId:area, projectId:p.id,
      status: i<=done?'completed':'active', completedAt: i<=done? iso(addDays(today,-3)) : null,
      createdAt: iso(addDays(today, -(total-i)-2)) });
  };
  projTasks(projects[0], 12, 8, A('Trabajo'));
  projTasks(projects[1], 12, 3, A('Comunidad'));
  projTasks(projects[2], 11, 5, A('Familia'));
  T({ title:'Acceso al endpoint nuevo de inventarios', areaId:A('Trabajo'), isWaitingFor:true, waitingFrom:'Samuel', createdAt: iso(addDays(today,-3)) });
  T({ title:'Confirmación de apertura de cuenta', areaId:A('Finanzas'), isWaitingFor:true, waitingFrom:'Banco', createdAt: iso(addDays(today,-7)) });
  T({ title:'Cotización de proveedor de empaque', areaId:A('Trabajo'), isWaitingFor:true, waitingFrom:'Compras / María', createdAt: iso(addDays(today,-2)) });
  T({ title:'Reunión de planeación trimestral', areaId:A('Trabajo'), dueDate: iso(addDays(today,2)) });
  T({ title:'Cumpleaños mamá – comprar regalo', areaId:A('Familia'), dueDate: iso(addDays(today,5)) });
  T({ title:'Aprender a hacer pan de masa madre', areaId:A('Familia'), isSomeday:true });
  T({ title:'Idea: dashboard de KPIs por departamento', areaId:A('Trabajo'), isSomeday:true });
  const inbox = ['Investigar opciones de seguro médico para empleados','Revisar artículo sobre webhooks','Comprar regalo de cumpleaños']
    .map(rawText => ({ id: uid(), rawText, capturedAt: iso(new Date()), processed:false }));
  return { areas, contexts, projects, tasks, events, inbox };
}

/* ----------------------------- Persistencia ----------------------------- */
const LS_KEY = 'todo-app-data-v1';
const hasCloud = () => !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY);
let sb = null;
if (hasCloud()) { try { sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY); } catch(e){ console.warn(e); } }

async function loadData() {
  if (sb) {
    try {
      const { data, error } = await sb.from('app_state').select('data').eq('id','main').maybeSingle();
      if (!error && data && data.data) return data.data;
    } catch(e){ console.warn('cloud load falló, uso local', e); }
  }
  const local = localStorage.getItem(LS_KEY);
  if (local) return JSON.parse(local);
  return seed();
}
let saveTimer = null;
function saveData(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
  if (sb) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      sb.from('app_state').upsert({ id:'main', data, updated_at: new Date().toISOString() }).then(({error}) => {
        if (error) console.warn('cloud save error', error);
      });
    }, 600);
  }
}

/* ----------------------------- Iconos ----------------------------- */
const Icon = ({ name }) => {
  const p = {
    pending: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    today: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    inbox: 'M3 13h4l2 3h6l2-3h4M3 13l3-8h12l3 8M3 13v6h18v-6',
    search: 'M11 19a8 8 0 118-8 8 8 0 01-8 8zM21 21l-4.35-4.35',
    upcoming: 'M3 8h18M7 3v4M17 3v4M4 6h16v15H4z',
    areas: 'M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z',
    contexts: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01',
    projects: 'M3 5h18M3 12h18M3 19h18',
    calendar: 'M3 8h18M7 3v4M17 3v4M4 6h16v15H4z',
    completed: 'M20 6L9 17l-5-5',
    archive: 'M4 7h16M6 7v13h12V7M9 11h6M8 3h8l1 4H7l1-4z',
    waiting: 'M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    someday: 'M21 12.8A8.5 8.5 0 1111.2 3a6.5 6.5 0 009.8 9.8z',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    settings: 'M12 15.5A3.5 3.5 0 1112 8a3.5 3.5 0 010 7.5zM19.4 15a1.7 1.7 0 00.34 1.88l.04.04a2 2 0 01-2.83 2.83l-.04-.04A1.7 1.7 0 0015 19.4a1.7 1.7 0 00-1 .6l-.03.04a2 2 0 01-3.46-2l.02-.05A1.7 1.7 0 009.4 15a1.7 1.7 0 00-1.88-.34l-.05.02a2 2 0 01-2-3.46l.04-.03A1.7 1.7 0 006.6 9a1.7 1.7 0 00-.6-1l-.04-.03a2 2 0 012.83-2.83l.04.04A1.7 1.7 0 0010 4.6a1.7 1.7 0 001-.6l.03-.04a2 2 0 013.46 2l-.02.05A1.7 1.7 0 0014.6 9a1.7 1.7 0 001.88.34l.05-.02a2 2 0 012 3.46l-.04.03A1.7 1.7 0 0019.4 15z',
  }[name];
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={p}/></svg>;
};

/* ----------------------------- Componentes pequeños ----------------------------- */
function Ring({ progress, color }) {
  const r = 12, c = 2*Math.PI*r;
  return (
    <svg className="ring" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r={r} fill="none" stroke="rgba(150,150,160,0.25)" strokeWidth="3"/>
      <circle cx="15" cy="15" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c*(1-progress)} transform="rotate(-90 15 15)"/>
    </svg>
  );
}

function ColorPicker({ value, onChange }) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:8}}>
      {COLOR_OPTS.map(c => (
        <div key={c} onClick={()=>onChange(c)} style={{
          width:32,height:32,borderRadius:'50%',background:c,cursor:'pointer',
          border:value===c?'3px solid var(--text-1)':'3px solid transparent',boxSizing:'border-box'
        }}/>
      ))}
    </div>
  );
}

const WHEN_COLORS = { over:'#FF6B6B', today:'#4F8CFF', soon:'var(--text-2)', muted:'var(--text-3)' };
function whenInfo(due) {
  if (!due) return { label:'Sin fecha', tone:'muted' };
  const d = Math.round((startOfDay(due) - startOfDay(new Date())) / 86400000);
  if (d === 0) return { label:'Hoy', tone:'today' };
  if (d === 1) return { label:'Mañana', tone:'soon' };
  if (d === -1) return { label:'Ayer', tone:'over' };
  if (d > 1) return { label:'En ' + d + ' días', tone:'soon' };
  return { label:'Vencida hace ' + (-d) + ' días', tone:'over' };
}

function TaskCard({ task, areas, contexts, onToggle, onOpen, showWaiting, showWhen }) {
  const area = areas.find(a => a.id === task.areaId);
  const ctx = contexts.find(c => c.id === task.contextId);
  const w = showWhen ? whenInfo(task.dueDate) : null;
  const overdue = task.status === 'active' && task.dueDate && startOfDay(task.dueDate) < startOfDay(new Date());
  return (
    <div className={'task' + (task.status === 'completed' ? ' done' : '') + (overdue ? ' overdue' : '')} onClick={onOpen}>
      <div className={'checkbox' + (task.status === 'completed' ? ' checked' : '')}
           onClick={(e) => { e.stopPropagation(); onToggle(); }} />
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {w && <span style={{color: WHEN_COLORS[w.tone], fontWeight:600}}>{w.label}</span>}
          {w && (area || ctx || task.isQuickWin) && <span style={{color:'var(--text-3)'}}>·</span>}
          {area && <><span className="area-dot" style={{background: area.color}}/><span>{area.name}</span></>}
          {ctx && <span className="context-tag">{ctx.name}</span>}
          {task.isQuickWin && <span className="quick-badge">2 MIN</span>}
        </div>
        {showWaiting && (
          <div className="waiting-since">
            {task.waitingFrom ? task.waitingFrom + ' · ' : ''}esperando hace {daysBetween(task.createdAt)} {daysBetween(task.createdAt)===1?'día':'días'}
          </div>
        )}
      </div>
    </div>
  );
}

function InsightGrid({ cards }) {
  if (!cards || cards.length===0) return null;
  return (
    <div className="insight-grid">
      {cards.map(c => (
        <div className="insight-card" key={c.label}>
          <div className="insight-value">{c.value}</div>
          <div className="insight-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function TaskListPage({ title, greeting, stats, tasks, data, act, onOpen, onAdd, emptyTitle, emptyText, showWhen=true, insights }) {
  return (
    <>
      <div className="header">
        <div className="greeting">{greeting}</div>
        <div className="title-row">
          <h1>{title}</h1>
          {onAdd && <button className="add-task-btn" onClick={onAdd}>+ Tarea</button>}
        </div>
        <div className="stats">{stats}</div>
      </div>
      <InsightGrid cards={insights} />
      <div className="content task-list-content">
        {tasks.length===0 && <Empty ico="✓" title={emptyTitle} text={emptyText} />}
        {tasks.map(t => <TaskCard key={t.id} task={t} areas={data.areas} contexts={data.contexts}
          showWhen={showWhen} onToggle={()=>act.toggle(t.id)} onOpen={()=>onOpen(t.id)} />)}
      </div>
    </>
  );
}

function Empty({ ico, title, text }) {
  return <div className="empty"><div className="ico">{ico}</div><h3>{title}</h3><p>{text}</p></div>;
}

/* ----------------------------- Vistas ----------------------------- */
function Pendientes({ data, act, onOpen }) {
  // Todas las tareas activas excepto "algún día". Ordenadas por fecha (sin fecha al final).
  const pend = data.tasks
    .filter(t => t.status==='active' && !t.isSomeday)
    .sort((a,b) => {
      if (!a.dueDate && !b.dueDate) return new Date(a.createdAt) - new Date(b.createdAt);
      if (!a.dueDate) return 1;            // sin fecha al final
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate); // más próximo primero
    });
  return (
    <>
      <div className="header">
        <div className="greeting">Todo lo que tienes por hacer</div>
        <div className="title-row">
          <h1>Pendientes</h1>
          <div style={{display:'flex',gap:8}}>
            <button className="icon-btn" onClick={() => act.setOverlay('inbox')}>⬚</button>
            <button className="icon-btn" onClick={() => act.setOverlay('search')}>⌕</button>
            <button className="icon-btn" onClick={() => act.setOverlay('more')}>⋯</button>
          </div>
        </div>
        <div className="stats">{pend.length} pendientes</div>
      </div>
      <div className="content">
        {pend.length===0 &&
          <Empty ico="✓" title="Todo al día" text="No tienes pendientes. Toca + para capturar algo." />}
        {pend.map(t => <TaskCard key={t.id} task={t} areas={data.areas} contexts={data.contexts}
          showWhen onToggle={()=>act.toggle(t.id)} onOpen={()=>onOpen(t.id)} />)}
      </div>
    </>
  );
}

function Inbox({ data, act, onProcess, onClose }) {
  const [text, setText] = useState('');
  const items = data.inbox.filter(i => !i.processed).sort((a,b)=> new Date(b.capturedAt)-new Date(a.capturedAt));
  const add = () => { if (!text.trim()) return; act.addInbox(text.trim()); setText(''); };
  return (
    <>
      <div className="header">
        <div className="greeting">Captura sin procesar</div>
        <div className="title-row"><h1>Inbox</h1>{onClose && <button className="icon-btn" onClick={onClose}>✕</button>}</div>
        <div className="stats">{items.length} items por procesar</div>
      </div>
      <div className="content">
        <div className="quick-row">
          <input className="quick-input" placeholder="Captura rápida…" value={text}
            onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} />
          <button className="send-btn" onClick={add} disabled={!text.trim()}>↑</button>
        </div>
        {items.length===0 && <Empty ico="⬚" title="Inbox vacío" text="Apunta algo rápido aquí y procésalo después con las 7 preguntas." />}
        {items.length>0 && <div className="banner">
          <div className="banner-title">Procesar Inbox</div>
          <div className="banner-text">Toca un item para clarificarlo con las 7 preguntas de GTD.</div>
        </div>}
        {items.map(i => (
          <div className="inbox-item" key={i.id} onClick={()=>onProcess(i)}>
            <div className="inbox-text">{i.rawText}</div>
            <div className="inbox-time">{cap(fmt(i.capturedAt, { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }))}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function Areas({ data, onOpenArea, onEditArea, onAddArea }) {
  const active = (aid) => data.tasks.filter(t => t.areaId===aid && t.status==='active');
  const projs = (aid) => data.projects.filter(p => p.areaId===aid && p.status==='active');
  const total = data.tasks.filter(t => t.status==='active').length;
  return (
    <>
      <div className="header">
        <div className="greeting">Áreas de responsabilidad</div>
        <div className="title-row">
          <h1>Áreas</h1>
          <button className="icon-btn" style={{fontSize:24,lineHeight:1}} onClick={onAddArea}>+</button>
        </div>
        <div className="stats">{data.areas.length} áreas · {total} tareas activas</div>
      </div>
      <div className="content">
        {data.areas.length===0 && <Empty ico="◇" title="Sin áreas" text="Toca + para crear tu primera área." />}
        {data.areas.map(a => {
          const t = active(a.id);
          return (
            <div className="area-card" key={a.id} onClick={()=>onOpenArea(a)}>
              <div className="bar" style={{background:a.color}}/>
              <div className="area-card-header">
                <div className="area-name">{a.name}</div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div className="area-count">{t.length}</div>
                  <button className="icon-btn" style={{fontSize:15}} onClick={e=>{e.stopPropagation();onEditArea(a);}}>✎</button>
                </div>
              </div>
              <div className="area-meta">
                <span><strong>{projs(a.id).length}</strong> {projs(a.id).length===1?'proyecto':'proyectos'}</span>
                <span><strong>{t.filter(x=>x.isWaitingFor).length}</strong> esperando</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Contexts({ data, onOpenContext, onEditContext, onAddContext }) {
  const active = (cid) => data.tasks.filter(t => t.contextId===cid && t.status==='active');
  const total = data.tasks.filter(t => t.status==='active' && t.contextId).length;
  return (
    <>
      <div className="header">
        <div className="greeting">Dónde / con qué lo haces</div>
        <div className="title-row">
          <h1>Contextos</h1>
          <button className="icon-btn" style={{fontSize:24,lineHeight:1}} onClick={onAddContext}>+</button>
        </div>
        <div className="stats">{data.contexts.length} contextos · {total} tareas</div>
      </div>
      <div className="content">
        {data.contexts.length===0 && <Empty ico="🏷" title="Sin contextos" text="Toca + para crear tu primer contexto." />}
        {data.contexts.map(c => (
          <div className="area-card" key={c.id} onClick={()=>onOpenContext(c)}>
            <div className="bar" style={{background:c.color}}/>
            <div className="area-card-header">
              <div className="area-name"><span className="area-dot" style={{background:c.color,display:'inline-block',marginRight:8}}/>{c.name}</div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div className="area-count">{active(c.id).length}</div>
                <button className="icon-btn" style={{fontSize:15}} onClick={e=>{e.stopPropagation();onEditContext(c);}}>✎</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Projects({ data, onOpenProject, onEditProject, onAddProject }) {
  const active = data.projects.filter(p => p.status==='active');
  const stats = (p) => {
    const ts = data.tasks.filter(t => t.projectId===p.id && t.status!=='deleted' && t.status!=='cancelled');
    const done = ts.filter(t => t.status==='completed').length;
    const active = ts.filter(t => t.status==='active');
    const next = active.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))[0];
    return { total: ts.length, done, progress: ts.length? done/ts.length : 0,
      active: active.length, next: next ? (next.nextAction || next.title) : null };
  };
  return (
    <>
      <div className="header">
        <div className="greeting">Resultados multi-paso</div>
        <div className="title-row">
          <h1>Proyectos</h1>
          <button className="icon-btn" style={{fontSize:24,lineHeight:1}} onClick={onAddProject}>+</button>
        </div>
        <div className="stats">{active.length} activos</div>
      </div>
      <div className="content">
        {active.length===0 && <Empty ico="▤" title="Sin proyectos activos" text="Toca + para crear un proyecto, o crea uno desde el flujo de tarea." />}
        {active.map(p => {
          const s = stats(p); const area = data.areas.find(a=>a.id===p.areaId);
          const color = area?.color || '#4F8CFF';
          return (
            <div className="project" key={p.id} onClick={()=>onOpenProject(p)}>
              <div className="project-header">
                <Ring progress={s.progress} color={color} />
                <div style={{flex:1}}>
                  <div className="project-title">{p.name}</div>
                  <div className="project-meta">{area?.name || 'Sin área'}</div>
                </div>
                <button className="icon-btn" style={{fontSize:15}} onClick={e=>{e.stopPropagation();onEditProject(p);}}>✎</button>
              </div>
              {p.outcome && <div className="project-outcome">{p.outcome}</div>}
              <div className="project-progress">
                <div style={{width:`${Math.round(s.progress*100)}%`,background:color}} />
              </div>
              <div className="project-stats">
                <span>{Math.round(s.progress*100)}%</span>
                <span>{s.active} abiertas</span>
                <span>{s.done} de {s.total}</span>
              </div>
              {s.next && <div className="project-next" style={{borderLeftColor:color}}><strong>Siguiente: </strong>{s.next}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function CalendarView({ data, act, onOpen }) {
  const [month, setMonth] = useState(startOfDay(new Date()));
  const [sel, setSel] = useState(startOfDay(new Date()));
  const tasksOn = (d) => data.tasks.filter(t => t.status==='active' && isSameDay(t.dueDate, d));
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = (first.getDay()+6)%7; // lunes=0
    const dim = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate();
    const arr = []; for (let i=0;i<lead;i++) arr.push(null);
    for (let d=1;d<=dim;d++) arr.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (arr.length%7) arr.push(null);
    return arr;
  }, [month]);
  const dayTasks = tasksOn(sel);
  return (
    <>
      <div className="header">
        <div className="greeting">{cap(fmt(month, { month:'long', year:'numeric' }))}</div>
        <div className="title-row"><h1>Calendario</h1></div>
        <div className="stats">Tareas con fecha</div>
      </div>
      <div className="content">
        <div className="cal-nav">
          <button onClick={()=>setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))}>‹</button>
          <span className="m">{cap(fmt(month, { month:'long', year:'numeric' }))}</span>
          <button onClick={()=>setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))}>›</button>
        </div>
        <div className="cal-grid">
          {['L','M','M','J','V','S','D'].map((d,i)=><div className="cal-lbl" key={i}>{d}</div>)}
          {cells.map((d,i) => {
            if (!d) return <div key={i} className="cal-day muted"/>;
            const ts = tasksOn(d);
            const cls = 'cal-day' + (isToday(d)?' today':'') + (isSameDay(d,sel)&&!isToday(d)?' sel':'');
            return (
              <div key={i} className={cls} onClick={()=>setSel(startOfDay(d))}>
                <span>{d.getDate()}</span>
                <div className="cal-dots">{ts.slice(0,3).map((t,j)=>{
                  const c = data.areas.find(a=>a.id===t.areaId)?.color || '#4F8CFF';
                  return <span className="cal-dot" key={j} style={{background:c}}/>;
                })}</div>
              </div>
            );
          })}
        </div>
        <div className="section-title">{cap(fmt(sel, { weekday:'long', day:'numeric' }))}</div>
        {dayTasks.length===0 && <p style={{fontSize:13,color:'var(--text-2)',padding:'4px 0'}}>Sin tareas con fecha este día</p>}
        {dayTasks.map(t => <TaskCard key={t.id} task={t} areas={data.areas} contexts={data.contexts}
          onToggle={()=>act.toggle(t.id)} onOpen={()=>onOpen(t.id)} />)}
      </div>
    </>
  );
}

/* ----------------------------- Flujo de 7 pasos ----------------------------- */
function AddFlow({ data, act, initialText, onClose }) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(initialText || '');
  const [outcome, setOutcome] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [project, setProject] = useState('standalone'); // 'standalone' | 'new' | projectId
  const [ctx, setCtx] = useState(null);
  const [area, setArea] = useState(null);
  const [when, setWhen] = useState('today');
  const [specific, setSpecific] = useState(fmt(new Date(),{year:'numeric'})+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0'));
  const [rec, setRec] = useState('none');

  const steps = [
    { label:'Paso 1 de 7 · Captura', q:'¿Qué tienes en la mente?', h:'Escribe lo primero que se te ocurra. No te preocupes por organizarlo — eso viene después.',
      body: <textarea className="ta" rows="4" autoFocus placeholder="Ej. Conseguir nuevo proveedor de empaque" value={title} onChange={e=>setTitle(e.target.value)} /> },
    { label:'Paso 2 de 7 · Resultado', q:'¿Cómo se ve esto cuando esté completo?', h:'Define el “éxito” en una frase. Es opcional, pero ayuda a saber cuándo terminaste.',
      body: <textarea className="ta" rows="3" placeholder="Ej. Contrato firmado con mejor precio" value={outcome} onChange={e=>setOutcome(e.target.value)} /> },
    { label:'Paso 3 de 7 · Siguiente acción', q:'¿Cuál es el siguiente paso físico y visible?', h:'Un verbo en infinitivo. Algo que puedas hacer en menos de una hora.',
      body: <textarea className="ta" rows="2" placeholder="Ej. Buscar 3 proveedores en el directorio" value={nextAction} onChange={e=>setNextAction(e.target.value)} /> },
    { label:'Paso 4 de 7 · Proyecto', q:'¿Es parte de un proyecto?', h:'Si requiere más de un paso, es un proyecto. Si no, déjalo como tarea suelta.',
      body: <div className="options">
        <div className={'option'+(project==='new'?' sel':'')} onClick={()=>setProject('new')}>
          <span className="odot" style={{background:area?data.areas.find(a=>a.id===area)?.color:'#4F8CFF'}}/>Crear proyecto nuevo con este nombre{project==='new'&&<span className="check">✓</span>}</div>
        <div className={'option'+(project==='standalone'?' sel':'')} onClick={()=>setProject('standalone')}>
          <span className="odot" style={{background:'var(--text-3)'}}/>Es una tarea suelta{project==='standalone'&&<span className="check">✓</span>}</div>
        {data.projects.filter(p=>p.status==='active').map(p=>(
          <div className={'option'+(project===p.id?' sel':'')} key={p.id} onClick={()=>setProject(p.id)}>
            <span className="odot" style={{background:data.areas.find(a=>a.id===p.areaId)?.color||'#4F8CFF'}}/>{p.name}{project===p.id&&<span className="check">✓</span>}</div>
        ))}
      </div> },
    { label:'Paso 5 de 7 · Contexto', q:'¿Dónde / con qué puedes hacerlo?', h:'El contexto te dice cuándo es ejecutable. Filtras tu lista cuando estés en ese lugar.',
      body: <div className="options">
        <div className={'option'+(ctx===null?' sel':'')} onClick={()=>setCtx(null)}><span className="odot" style={{background:'var(--text-3)'}}/>Sin contexto{ctx===null&&<span className="check">✓</span>}</div>
        {data.contexts.map(c=>(
          <div className={'option'+(ctx===c.id?' sel':'')} key={c.id} onClick={()=>setCtx(c.id)}><span className="odot" style={{background:c.color}}/>{c.name}{ctx===c.id&&<span className="check">✓</span>}</div>
        ))}
      </div> },
    { label:'Paso 6 de 7 · Área', q:'¿Área de responsabilidad?', h:'Determina el color y agrupa con otras tareas de la misma esfera de tu vida.',
      body: <div className="options">
        <div className={'option'+(area===null?' sel':'')} onClick={()=>setArea(null)}><span className="odot" style={{background:'var(--text-3)'}}/>Sin área{area===null&&<span className="check">✓</span>}</div>
        {data.areas.map(a=>(
          <div className={'option'+(area===a.id?' sel':'')} key={a.id} onClick={()=>setArea(a.id)}><span className="odot" style={{background:a.color}}/>{a.name}{area===a.id&&<span className="check">✓</span>}</div>
        ))}
      </div> },
    { label:'Paso 7 de 7 · Cuándo', q:'¿Cuándo lo haces?', h:'Solo pon fecha si realmente tiene que ser ese día. Lo demás vive en contexto.',
      body: <div className="options">
        {[['today','Hoy'],['tomorrow','Mañana'],['thisWeek','Esta semana'],['noDate','Sin fecha (cuando esté en contexto)'],['someday','Algún día / Tal vez'],['specific','Fecha específica…']].map(([v,l])=>(
          <div className={'option'+(when===v?' sel':'')} key={v} onClick={()=>setWhen(v)}>{l}{when===v&&<span className="check">✓</span>}</div>
        ))}
        {when==='specific' && <input className="quick-input" type="date" value={specific} onChange={e=>setSpecific(e.target.value)} />}
        <select className="quick-input" value={rec} onChange={e=>setRec(e.target.value)} style={{marginTop:4}}>
          {RECURRENCE.map(([v,l])=><option value={v} key={v}>↻ {l}</option>)}
        </select>
      </div> },
  ];
  const s = steps[step];
  const canNext = step!==0 || title.trim().length>0;
  const finish = () => {
    let dueDate=null, someday=false;
    const today = startOfDay(new Date());
    if (when==='today') dueDate=iso(today);
    else if (when==='tomorrow') dueDate=iso(addDays(today,1));
    else if (when==='thisWeek') dueDate=iso(addDays(today,3));
    else if (when==='someday') someday=true;
    else if (when==='specific') dueDate=iso(startOfDay(new Date(specific+'T00:00:00')));
    act.createTask({ title:title.trim(), outcome:outcome.trim()||null, nextAction:nextAction.trim()||null,
      projectChoice:project, contextId:ctx, areaId:area, dueDate, isSomeday:someday, recurrence:rec });
    onClose();
  };
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet sheet-full" onClick={e=>e.stopPropagation()}>
        <div className="flow">
          <div className="progress">{steps.map((_,i)=><div className={'pdot'+(i<=step?' on':'')} key={i}/>)}</div>
          <div className="flow-body">
            <div className="step-label">{s.label}</div>
            <div className="question">{s.q}</div>
            <div className="hint">{s.h}</div>
            {s.body}
          </div>
          <div className="actions">
            <button className="btn" onClick={()=> step===0 ? onClose() : setStep(step-1)}>{step===0?'Cancelar':'← Atrás'}</button>
            <button className="btn btn-primary" disabled={!canNext}
              onClick={()=> step===steps.length-1 ? finish() : setStep(step+1)}>
              {step===steps.length-1?'Crear tarea ✓':'Siguiente →'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Editar tarea ----------------------------- */
function EditTask({ data, task, act, onClose }) {
  const [t, setT] = useState({ ...task });
  const upd = (k,v) => setT(prev => ({ ...prev, [k]: v }));
  const dueStr = t.dueDate ? new Date(t.dueDate).toISOString().slice(0,10) : '';
  const events = data.events.filter(e => e.taskId === task.id).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
  const save = () => { act.updateTask(t); onClose(); };
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div className="form">
          <h2>Detalle</h2>
          <div className="field"><label>Título</label><textarea value={t.title} onChange={e=>upd('title',e.target.value)} /></div>
          <div className="field"><label>Resultado deseado</label><textarea value={t.outcome||''} onChange={e=>upd('outcome',e.target.value||null)} /></div>
          <div className="field"><label>Siguiente acción</label><textarea value={t.nextAction||''} onChange={e=>upd('nextAction',e.target.value||null)} /></div>
          <div className="row2">
            <div className="field"><label>Área</label>
              <select value={t.areaId||''} onChange={e=>upd('areaId',e.target.value||null)}>
                <option value="">Sin área</option>{data.areas.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}
              </select></div>
            <div className="field"><label>Contexto</label>
              <select value={t.contextId||''} onChange={e=>upd('contextId',e.target.value||null)}>
                <option value="">Sin contexto</option>{data.contexts.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
              </select></div>
          </div>
          <div className="row2">
            <div className="field"><label>Proyecto</label>
              <select value={t.projectId||''} onChange={e=>upd('projectId',e.target.value||null)}>
                <option value="">Tarea suelta</option>{data.projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}
              </select></div>
            <div className="field"><label>Repetir</label>
              <select value={t.recurrence} onChange={e=>upd('recurrence',e.target.value)}>
                {RECURRENCE.map(([v,l])=><option value={v} key={v}>{l}</option>)}
              </select></div>
          </div>
          <div className="field"><label>Fecha</label>
            <input type="date" value={dueStr} onChange={e=>upd('dueDate', e.target.value? iso(startOfDay(new Date(e.target.value+'T00:00:00'))) : null)} /></div>

          <div className="toggle-row"><span>Quick win (2 min)</span><input type="checkbox" checked={t.isQuickWin} onChange={e=>upd('isQuickWin',e.target.checked)} /></div>
          <div className="toggle-row"><span>Estoy esperando a alguien</span><input type="checkbox" checked={t.isWaitingFor} onChange={e=>upd('isWaitingFor',e.target.checked)} /></div>
          {t.isWaitingFor && <div className="field" style={{marginTop:10}}><label>¿De quién?</label><input value={t.waitingFrom||''} onChange={e=>upd('waitingFrom',e.target.value||null)} /></div>}
          <div className="toggle-row"><span>Algún día / Tal vez</span><input type="checkbox" checked={t.isSomeday} onChange={e=>upd('isSomeday',e.target.checked)} /></div>

          <div className="section-title">Línea de tiempo</div>
          <div className="timeline">
            {events.length===0 && <p style={{fontSize:13,color:'var(--text-2)'}}>Sin eventos</p>}
            {events.map(e=>(
              <div className="tl-item" key={e.id}><div className="tl-dot"/>
                <div><div className="tl-text">{e.detail}</div>
                <div className="tl-time">{fmt(e.timestamp,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div></div></div>
            ))}
          </div>

          <div style={{display:'flex',gap:10,marginTop:18}}>
            <button className="btn btn-primary" onClick={save}>Guardar</button>
            <button className="btn" onClick={()=>{ act.toggle(task.id); onClose(); }}>{task.status==='completed'?'Reabrir':'Completar'}</button>
          </div>
          <div style={{display:'flex',gap:10,marginTop:10}}>
            {task.status==='active'
              ? <button className="btn" onClick={()=>{ act.archive(task.id); onClose(); }}>Archivar</button>
              : <button className="btn" onClick={()=>{ act.restore(task.id); onClose(); }}>Restaurar</button>}
            <button className="btn danger" onClick={()=>{ if(confirm('¿Borrar definitivamente? No se puede deshacer.')){ act.remove(task.id); onClose(); } }}>Borrar definitivo</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Más / listas / búsqueda ----------------------------- */
function ListSheet({ title, tasks, data, act, onOpen, onClose, showWaiting }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet sheet-full" onClick={e=>e.stopPropagation()}>
        <div className="header"><div className="title-row"><h1>{title}</h1><button className="icon-btn" onClick={onClose}>✕</button></div></div>
        <div className="content">
          {tasks.length===0 && <Empty ico="—" title="Vacío" text="No hay tareas aquí." />}
          {tasks.map(t => <TaskCard key={t.id} task={t} areas={data.areas} contexts={data.contexts}
            showWaiting={showWaiting} onToggle={()=>act.toggle(t.id)} onOpen={()=>onOpen(t.id)} />)}
        </div>
      </div>
    </div>
  );
}

function MoreMenu({ items, onPick, onClose }) {
  const fallback = [
    { key:'waiting', label:'Esperando', icon:'waiting' },
    { key:'someday', label:'Algún día', icon:'someday' },
    { key:'completed', label:'Completadas', icon:'completed' },
    { key:'settings', label:'Ajustes', icon:'settings' },
  ];
  const rows = items || fallback;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div className="form">
          <h2>Más</h2>
          {rows.map(item=>(
            <div key={item.key} className="option menu-option" style={{marginBottom:8}} onClick={()=>onPick(item.key)}>
              <Icon name={item.icon || item.key} />
              <span>{item.label}</span>
              {item.count!==undefined && <span className="menu-count">{item.count}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContextsSheet({ data, onPick, onClose }) {
  const count = (id) => data.tasks.filter(t => t.contextId===id && t.status==='active').length;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div className="form">
          <h2>Por contexto</h2>
          {data.contexts.map(c=>(
            <div key={c.id} className="option" style={{marginBottom:8}} onClick={()=>onPick(c.id)}>
              <span className="odot" style={{background:c.color}}/>{c.name}
              <span style={{marginLeft:'auto',color:'var(--text-3)'}}>{count(c.id)}</span>
            </div>
          ))}
          {data.contexts.length===0 && <p style={{fontSize:13,color:'var(--text-2)'}}>Aún no tienes contextos.</p>}
        </div>
      </div>
    </div>
  );
}

function SearchSheet({ data, act, onOpen, onClose }) {
  const [q,setQ] = useState('');
  const res = q.trim() ? data.tasks.filter(t => (t.title+(t.nextAction||'')+(t.outcome||'')).toLowerCase().includes(q.toLowerCase())) : [];
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet sheet-full" onClick={e=>e.stopPropagation()}>
        <div className="header"><div className="title-row"><h1>Buscar</h1><button className="icon-btn" onClick={onClose}>✕</button></div></div>
        <div className="content">
          <input className="quick-input" autoFocus placeholder="Buscar en activas y archivadas" value={q} onChange={e=>setQ(e.target.value)} style={{marginBottom:12}}/>
          {res.map(t => <TaskCard key={t.id} task={t} areas={data.areas} contexts={data.contexts}
            onToggle={()=>act.toggle(t.id)} onOpen={()=>onOpen(t.id)} />)}
        </div>
      </div>
    </div>
  );
}

function ArchiveSheet({ data, act, onOpen, onClose }) {
  const [filter,setFilter] = useState('completed');
  const tasks = data.tasks.filter(t => t.status===filter)
    .sort((a,b)=> new Date(b.completedAt||b.deletedAt||b.createdAt) - new Date(a.completedAt||a.deletedAt||a.createdAt));
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet sheet-full" onClick={e=>e.stopPropagation()}>
        <div className="header"><div className="title-row"><h1>Archivo</h1><button className="icon-btn" onClick={onClose}>✕</button></div></div>
        <div className="content">
          <div className="pill-row">
            {[['completed','Completadas'],['deleted','Eliminadas'],['cancelled','Canceladas']].map(([k,l])=>(
              <div className={'pill'+(filter===k?' on':'')} key={k} onClick={()=>setFilter(k)}>{l}</div>
            ))}
          </div>
          {tasks.length===0 && <Empty ico="🗄" title="Vacío" text="No hay tareas aquí." />}
          {tasks.map(t => <TaskCard key={t.id} task={t} areas={data.areas} contexts={data.contexts}
            onToggle={()=>act.toggle(t.id)} onOpen={()=>onOpen(t.id)} />)}
        </div>
      </div>
    </div>
  );
}

function SettingsContent({ data, act }) {
  const deleted = data.tasks.filter(t=>t.status==='deleted');
  return (
    <>
      <h2>Ajustes</h2>
      <div className="toggle-row"><span>Tema</span><span style={{color:'var(--text-2)'}}>Sigue el sistema</span></div>
      <div className="toggle-row"><span>Sincronización</span>
        <span className={'sync-badge'+(hasCloud()?' on':'')}>{hasCloud()?'iCloud/Supabase activo':'Solo este dispositivo'}</span></div>
      <div style={{marginTop:16}}>
        <button className="btn" style={{width:'100%'}} disabled={deleted.length===0}
          onClick={()=>{ if(confirm(`Borrar definitivamente ${deleted.length} tareas eliminadas?`)) act.emptyTrash(); }}>
          Vaciar papelera ({deleted.length})</button>
      </div>
      <p style={{fontSize:12,color:'var(--text-3)',marginTop:16,lineHeight:1.5}}>To do · App de tareas basada en GTD. {hasCloud()?'Datos sincronizados en la nube.':'Datos guardados en este navegador. Configura Supabase para sincronizar con tu celular.'}</p>
    </>
  );
}

function SettingsPage({ data, act }) {
  return (
    <>
      <div className="header">
        <div className="greeting">Preferencias de la app</div>
        <div className="title-row"><h1>Ajustes</h1></div>
        <div className="stats">Sistema, sincronización y papelera</div>
      </div>
      <div className="content settings-page">
        <div className="settings-card">
          <SettingsContent data={data} act={act} />
        </div>
      </div>
    </>
  );
}

function SettingsSheet({ data, act, onClose }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div className="form">
          <SettingsContent data={data} act={act} />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Formularios CRUD ----------------------------- */
function AreaForm({ area, onSave, onDelete, onClose }) {
  const [name, setName] = useState(area?.name || '');
  const [color, setColor] = useState(area?.color || '#4F8CFF');
  const isEdit = !!area?.id;
  const save = () => { onSave({ id: area?.id || uid(), name: name.trim(), color }); onClose(); };
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div className="form">
          <h2>{isEdit ? 'Editar área' : 'Nueva área'}</h2>
          <div className="field"><label>Nombre</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Trabajo" autoFocus /></div>
          <div className="field"><label>Color</label>
            <ColorPicker value={color} onChange={setColor} /></div>
          <div style={{display:'flex',gap:10,marginTop:18}}>
            <button className="btn btn-primary" disabled={!name.trim()} onClick={save}>
              {isEdit ? 'Guardar cambios' : 'Crear área'}</button>
            <button className="btn" onClick={onClose}>Cancelar</button>
          </div>
          {isEdit && <div style={{marginTop:10}}>
            <button className="btn danger" style={{width:'100%'}} onClick={()=>{
              if(confirm('¿Borrar esta área? Las tareas y proyectos quedarán sin área.')){ onDelete(area.id); onClose(); }
            }}>Borrar área</button>
          </div>}
        </div>
      </div>
    </div>
  );
}

function ContextForm({ ctx, onSave, onDelete, onClose }) {
  const [name, setName] = useState(ctx?.name || '');
  const [color, setColor] = useState(ctx?.color || '#4F8CFF');
  const isEdit = !!ctx?.id;
  const save = () => { onSave({ id: ctx?.id || uid(), name: name.trim(), color }); onClose(); };
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div className="form">
          <h2>{isEdit ? 'Editar contexto' : 'Nuevo contexto'}</h2>
          <div className="field"><label>Nombre</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. @oficina" autoFocus /></div>
          <div className="field"><label>Color</label>
            <ColorPicker value={color} onChange={setColor} /></div>
          <div style={{display:'flex',gap:10,marginTop:18}}>
            <button className="btn btn-primary" disabled={!name.trim()} onClick={save}>
              {isEdit ? 'Guardar cambios' : 'Crear contexto'}</button>
            <button className="btn" onClick={onClose}>Cancelar</button>
          </div>
          {isEdit && <div style={{marginTop:10}}>
            <button className="btn danger" style={{width:'100%'}} onClick={()=>{
              if(confirm('¿Borrar este contexto? Las tareas quedarán sin contexto.')){ onDelete(ctx.id); onClose(); }
            }}>Borrar contexto</button>
          </div>}
        </div>
      </div>
    </div>
  );
}

function ProjectForm({ project, areas, onSave, onComplete, onDelete, onClose }) {
  const [name, setName] = useState(project?.name || '');
  const [outcome, setOutcome] = useState(project?.outcome || '');
  const [areaId, setAreaId] = useState(project?.areaId || '');
  const isEdit = !!project?.id;
  const save = () => { onSave({ id: project?.id || uid(), name: name.trim(), outcome: outcome.trim()||null, areaId: areaId||null, status:'active' }); onClose(); };
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div className="form">
          <h2>{isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}</h2>
          <div className="field"><label>Nombre del proyecto</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Rediseño del sitio web" autoFocus /></div>
          <div className="field"><label>Resultado deseado</label>
            <textarea value={outcome} onChange={e=>setOutcome(e.target.value)} placeholder="¿Cómo se ve cuando esté terminado?" rows="2" /></div>
          <div className="field"><label>Área</label>
            <select value={areaId} onChange={e=>setAreaId(e.target.value)}>
              <option value="">Sin área</option>
              {areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select></div>
          <div style={{display:'flex',gap:10,marginTop:18}}>
            <button className="btn btn-primary" disabled={!name.trim()} onClick={save}>
              {isEdit ? 'Guardar cambios' : 'Crear proyecto'}</button>
            <button className="btn" onClick={onClose}>Cancelar</button>
          </div>
          {isEdit && <div style={{display:'flex',gap:10,marginTop:10}}>
            <button className="btn" style={{flex:1}} onClick={()=>{
              if(confirm('¿Marcar este proyecto como terminado?')){ onComplete(project.id); onClose(); }
            }}>✓ Terminado</button>
            <button className="btn danger" style={{flex:1}} onClick={()=>{
              if(confirm('¿Borrar este proyecto? Las tareas quedarán sueltas.')){ onDelete(project.id); onClose(); }
            }}>Borrar</button>
          </div>}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- App ----------------------------- */
function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(() =>
    window.matchMedia && window.matchMedia('(min-width: 768px)').matches ? 'today' : 'pending'
  );
  const [adding, setAdding] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [overlay, setOverlay] = useState(null);
  const [editingArea, setEditingArea] = useState(null);
  const [editingCtx, setEditingCtx] = useState(null);
  const [editingProject, setEditingProject] = useState(null);

  useEffect(() => { loadData().then(setData); }, []);
  const commit = (updater) => setData(prev => { const next = updater(structuredClone(prev)); saveData(next); return next; });

  const logEvent = (d, taskId, type, detail) => d.events.push({ id: uid(), taskId, type, detail, timestamp: iso(new Date()) });

  const act = {
    setOverlay,
    toggle: (id) => commit(d => { const t = d.tasks.find(x=>x.id===id); if(!t) return d;
      if (t.status==='completed') { t.status='active'; t.completedAt=null; logEvent(d,id,'reopened','Tarea reabierta'); }
      else { t.status='completed'; t.completedAt=iso(new Date()); logEvent(d,id,'completed','Tarea completada'); } return d; }),
    archive: (id) => commit(d => { const t=d.tasks.find(x=>x.id===id); if(t){ t.status='deleted'; t.deletedAt=iso(new Date()); logEvent(d,id,'deleted','Enviada a Archivo'); } return d; }),
    restore: (id) => commit(d => { const t=d.tasks.find(x=>x.id===id); if(t){ t.status='active'; t.completedAt=null; t.deletedAt=null; logEvent(d,id,'restored','Restaurada'); } return d; }),
    remove: (id) => commit(d => { d.tasks=d.tasks.filter(x=>x.id!==id); d.events=d.events.filter(e=>e.taskId!==id); return d; }),
    emptyTrash: () => commit(d => { const ids=d.tasks.filter(t=>t.status==='deleted').map(t=>t.id);
      d.tasks=d.tasks.filter(t=>t.status!=='deleted'); d.events=d.events.filter(e=>!ids.includes(e.taskId)); return d; }),
    addInbox: (text) => commit(d => { d.inbox.push({ id:uid(), rawText:text, capturedAt:iso(new Date()), processed:false }); return d; }),
    updateTask: (t) => commit(d => { const i=d.tasks.findIndex(x=>x.id===t.id); if(i>=0){ d.tasks[i]=t; logEvent(d,t.id,'edited','Tarea editada'); } return d; }),
    createTask: (o) => commit(d => {
      let projectId = null;
      if (o.projectChoice === 'new') { const p={ id:uid(), name:o.title, outcome:o.outcome, areaId:o.areaId, status:'active' }; d.projects.push(p); projectId=p.id; }
      else if (o.projectChoice !== 'standalone') projectId = o.projectChoice;
      const proj = d.projects.find(p=>p.id===projectId);
      const t = { id:uid(), title:o.title, outcome:o.outcome, nextAction:o.nextAction, projectId,
        contextId:o.contextId, areaId:o.areaId || proj?.areaId || null, dueDate:o.dueDate, recurrence:o.recurrence||'none',
        status:'active', isWaitingFor:false, waitingFrom:null, isQuickWin:false, isSomeday:o.isSomeday, createdAt:iso(new Date()), completedAt:null, deletedAt:null };
      d.tasks.push(t); logEvent(d, t.id, 'created', 'Tarea creada');
      if (o.fromInboxId) { const it=d.inbox.find(x=>x.id===o.fromInboxId); if(it) it.processed=true; }
      return d;
    }),
    createArea: (o) => commit(d => { d.areas.push(o); return d; }),
    updateArea: (o) => commit(d => { const i=d.areas.findIndex(x=>x.id===o.id); if(i>=0) d.areas[i]=o; return d; }),
    deleteArea: (id) => commit(d => { d.areas=d.areas.filter(x=>x.id!==id); d.tasks.forEach(t=>{if(t.areaId===id)t.areaId=null;}); d.projects.forEach(p=>{if(p.areaId===id)p.areaId=null;}); return d; }),
    createContext: (o) => commit(d => { d.contexts.push(o); return d; }),
    updateContext: (o) => commit(d => { const i=d.contexts.findIndex(x=>x.id===o.id); if(i>=0) d.contexts[i]=o; return d; }),
    deleteContext: (id) => commit(d => { d.contexts=d.contexts.filter(x=>x.id!==id); d.tasks.forEach(t=>{if(t.contextId===id)t.contextId=null;}); return d; }),
    createProject: (o) => commit(d => { d.projects.push(o); return d; }),
    updateProject: (o) => commit(d => { const i=d.projects.findIndex(x=>x.id===o.id); if(i>=0) d.projects[i]={...d.projects[i],...o}; return d; }),
    completeProject: (id) => commit(d => { const p=d.projects.find(x=>x.id===id); if(p) p.status='completed'; return d; }),
    deleteProject: (id) => commit(d => { d.projects=d.projects.filter(x=>x.id!==id); return d; }),
  };

  if (!data) return <div style={{padding:40,textAlign:'center',color:'var(--text-2)'}}>Cargando…</div>;

  const editingTask = editingId ? data.tasks.find(t=>t.id===editingId) : null;
  const openTask = (id) => setEditingId(id);

  const byDate = (a,b) => {
    if (!a.dueDate && !b.dueDate) return new Date(a.createdAt) - new Date(b.createdAt);
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  };
  const today = startOfDay(new Date());
  const inboxCount = data.inbox.filter(i=>!i.processed).length;
  const pendingTasks = data.tasks
    .filter(t=>t.status==='active' && !t.isSomeday)
    .sort(byDate);
  const todayTasks = data.tasks
    .filter(t=>t.status==='active' && !t.isSomeday && t.dueDate && startOfDay(t.dueDate) <= today)
    .sort(byDate);
  const upcomingTasks = data.tasks
    .filter(t=>t.status==='active' && !t.isSomeday && t.dueDate && startOfDay(t.dueDate) > today)
    .sort(byDate);
  const waitingTasks = data.tasks
    .filter(t=>t.status==='active' && t.isWaitingFor)
    .sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  const somedayTasks = data.tasks
    .filter(t=>t.status==='active' && t.isSomeday)
    .sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  const completedTasks = data.tasks
    .filter(t=>t.status==='completed')
    .sort((a,b)=>new Date(b.completedAt||b.createdAt)-new Date(a.completedAt||a.createdAt));
  const activeProjects = data.projects.filter(p=>p.status==='active').length;
  const calendarCount = data.tasks.filter(t=>t.status==='active' && t.dueDate).length;
  const archiveCount = data.tasks.filter(t=>t.status==='deleted' || t.status==='cancelled').length;
  const noDateCount = pendingTasks.filter(t=>!t.dueDate).length;
  const overdueCount = todayTasks.filter(t=>t.dueDate && startOfDay(t.dueDate) < today).length;
  const quickWinsCount = pendingTasks.filter(t=>t.isQuickWin).length;

  const navSections = [
    { title:'Captura', items:[
      { key:'inbox', label:'Inbox', icon:'inbox', count:inboxCount },
      { key:'search', label:'Buscar', icon:'search', overlay:'search' },
      { key:'pending', label:'Todo', icon:'pending', count:pendingTasks.length },
    ]},
    { title:'Plan', items:[
      { key:'today', label:'Hoy', icon:'today', count:todayTasks.length },
      { key:'upcoming', label:'Próximas', icon:'upcoming', count:upcomingTasks.length },
      { key:'calendar', label:'Calendario', icon:'calendar', count:calendarCount },
    ]},
    { title:'Organizar', items:[
      { key:'projects', label:'Proyectos', icon:'projects', count:activeProjects },
      { key:'areas', label:'Áreas', icon:'areas', count:data.areas.length },
      { key:'contexts', label:'Contextos', icon:'contexts', count:data.contexts.length },
    ]},
    { title:'Revisar', items:[
      { key:'completed', label:'Completadas', icon:'completed', count:completedTasks.length },
      { key:'waiting', label:'Esperando', icon:'waiting', count:waitingTasks.length },
      { key:'someday', label:'Algún día', icon:'someday', count:somedayTasks.length },
      { key:'archive', label:'Archivo', icon:'archive', count:archiveCount, overlay:'archive' },
      { key:'settings', label:'Ajustes', icon:'settings' },
    ]},
  ];
  const allNavItems = navSections.flatMap(s=>s.items);
  const mobileNavItems = [
    { key:'inbox', label:'Inbox', icon:'inbox', count:inboxCount },
    { key:'today', label:'Hoy', icon:'today', count:todayTasks.length },
    { key:'upcoming', label:'Próximas', icon:'upcoming', count:upcomingTasks.length },
    { key:'projects', label:'Proyectos', icon:'projects', count:activeProjects },
    { key:'more', label:'Más', icon:'more' },
  ];
  const mobileMoreItems = allNavItems.filter(item => !mobileNavItems.some(m => m.key===item.key));
  const moreActive = mobileMoreItems.some(item => item.key===tab);
  const pickMenuItem = (key) => {
    const item = allNavItems.find(x=>x.key===key);
    if (item?.overlay) setOverlay(item.overlay);
    else { setTab(key); setOverlay(null); }
  };
  const todayInsights = [
    { label:'Vencidas', value:overdueCount },
    { label:'Quick wins', value:quickWinsCount },
    { label:'Esperando', value:waitingTasks.length },
    { label:'Sin fecha', value:noDateCount },
  ];
  const upcomingInsights = [
    { label:'Próximas', value:upcomingTasks.length },
    { label:'Calendario', value:calendarCount },
    { label:'Proyectos', value:activeProjects },
    { label:'Algún día', value:somedayTasks.length },
  ];
  const pendingInsights = [
    { label:'Activas', value:pendingTasks.length },
    { label:'Hoy', value:todayTasks.length },
    { label:'Sin fecha', value:noDateCount },
    { label:'Esperando', value:waitingTasks.length },
  ];

  return (
    <div className="app">
      <aside className="desktop-sidebar">
        <div className="sidebar-brand">To do</div>
        <div className="sidebar-summary">
          <span>Hoy</span>
          <strong>{todayTasks.length}</strong>
          <small>{overdueCount} vencidas · {waitingTasks.length} esperando</small>
        </div>
        <div className="sidebar-nav">
          {navSections.map(section=>(
            <div className="sidebar-section" key={section.title}>
              <div className="sidebar-section-title">{section.title}</div>
              {section.items.map(item=>(
                <button key={item.key} className={'sidebar-item'+(tab===item.key?' active':'')} onClick={()=> item.overlay ? setOverlay(item.overlay) : setTab(item.key)}>
                  <Icon name={item.icon} /><span>{item.label}</span>
                  {item.count!==undefined && <strong>{item.count}</strong>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <button className="sidebar-add" onClick={()=>setAdding({})}>+ Nueva tarea</button>
      </aside>

      <main className="main-view">
        {tab==='inbox' && <Inbox data={data} act={act}
          onProcess={(item)=>{ setProcessing(item); }} />}
        {tab==='today' && <TaskListPage title="Today" greeting="Enfoque del día"
          stats={`${todayTasks.length} tareas para hoy o vencidas`} tasks={todayTasks}
          data={data} act={act} onOpen={openTask} onAdd={()=>setAdding({})} insights={todayInsights}
          emptyTitle="Nada para hoy" emptyText="Agrega una tarea o revisa Upcoming para planear lo siguiente." />}
        {tab==='upcoming' && <TaskListPage title="Upcoming" greeting="Lo que viene"
          stats={`${upcomingTasks.length} tareas programadas`} tasks={upcomingTasks}
          data={data} act={act} onOpen={openTask} onAdd={()=>setAdding({})} insights={upcomingInsights}
          emptyTitle="Sin próximas fechas" emptyText="Las tareas futuras aparecerán aquí cuando tengan fecha." />}
        {tab==='pending' && <TaskListPage title="Todo" greeting="Todas las tareas activas"
          stats={`${pendingTasks.length} tareas abiertas`} tasks={pendingTasks}
          data={data} act={act} onOpen={openTask} onAdd={()=>setAdding({})} insights={pendingInsights}
          emptyTitle="Todo al día" emptyText="No tienes pendientes. Toca + para capturar algo." />}
        {tab==='completed' && <TaskListPage title="Completed" greeting="Trabajo terminado"
          stats={`${completedTasks.length} tareas completadas`} tasks={completedTasks}
          data={data} act={act} onOpen={openTask}
          emptyTitle="Aún no hay completadas" emptyText="Cuando cierres tareas, quedarán aquí para consulta rápida." />}
        {tab==='waiting' && <TaskListPage title="Esperando" greeting="Delegado o bloqueado"
          stats={`${waitingTasks.length} tareas esperando respuesta`} tasks={waitingTasks}
          data={data} act={act} onOpen={openTask} showWhen={false}
          emptyTitle="Nada esperando" emptyText="Las tareas marcadas como esperando aparecerán aquí." />}
        {tab==='someday' && <TaskListPage title="Algún día" greeting="Ideas para revisar después"
          stats={`${somedayTasks.length} tareas aparcadas`} tasks={somedayTasks}
          data={data} act={act} onOpen={openTask} showWhen={false}
          emptyTitle="Nada en algún día" emptyText="Las ideas sin compromiso de fecha vivirán aquí." />}
        {tab==='settings' && <SettingsPage data={data} act={act} />}
        {tab==='areas' && <Areas data={data} onOpenArea={(a)=>setOverlay('area:'+a.id)} onEditArea={(a)=>setEditingArea(a)} onAddArea={()=>setEditingArea({})} />}
        {tab==='contexts' && <Contexts data={data} onOpenContext={(c)=>setOverlay('ctx:'+c.id)} onEditContext={(c)=>setEditingCtx(c)} onAddContext={()=>setEditingCtx({})} />}
        {tab==='projects' && <Projects data={data} onOpenProject={(p)=>setOverlay('project:'+p.id)} onEditProject={(p)=>setEditingProject(p)} onAddProject={()=>setEditingProject({})} />}
        {tab==='calendar' && <CalendarView data={data} act={act} onOpen={openTask} />}
      </main>

      {(['pending','today','upcoming','inbox'].includes(tab)) && <button className="fab" onClick={()=>setAdding({})}>+</button>}

      <div className="nav">
        {mobileNavItems.map(item=>(
          <div key={item.key} className={'nav-item'+(tab===item.key || (item.key==='more' && moreActive)?' active':'')}
            onClick={()=> item.key==='more' ? setOverlay('more') : setTab(item.key)}>
            <Icon name={item.icon} /><span>{item.label}</span>
          </div>
        ))}
      </div>

      {adding && <AddFlow data={data} act={act} initialText={adding.initialText} onClose={()=>setAdding(null)} />}
      {processing && <AddFlow data={data} act={{...act, createTask:(o)=>act.createTask({...o, fromInboxId:processing.id})}}
        initialText={processing.rawText} onClose={()=>setProcessing(null)} />}
      {editingTask && <EditTask data={data} task={editingTask} act={act} onClose={()=>setEditingId(null)} />}

      {overlay==='inbox' && (
        <div className="scrim" onClick={()=>setOverlay(null)}>
          <div className="sheet sheet-full" onClick={e=>e.stopPropagation()}>
            <Inbox data={data} act={act} onClose={()=>setOverlay(null)}
              onProcess={(item)=>{ setOverlay(null); setProcessing(item); }} />
          </div>
        </div>
      )}
      {overlay==='more' && <MoreMenu items={mobileMoreItems} onClose={()=>setOverlay(null)} onPick={pickMenuItem} />}
      {overlay==='search' && <SearchSheet data={data} act={act} onOpen={(id)=>{setOverlay(null);openTask(id);}} onClose={()=>setOverlay(null)} />}
      {overlay==='archive' && <ArchiveSheet data={data} act={act} onOpen={(id)=>{setOverlay(null);openTask(id);}} onClose={()=>setOverlay(null)} />}
      {overlay==='settings' && <SettingsSheet data={data} act={act} onClose={()=>setOverlay(null)} />}
      {overlay==='waiting' && <ListSheet title="Esperando" showWaiting data={data} act={act}
        tasks={data.tasks.filter(t=>t.status==='active'&&t.isWaitingFor)} onOpen={(id)=>{setOverlay(null);openTask(id);}} onClose={()=>setOverlay(null)} />}
      {overlay==='someday' && <ListSheet title="Algún día" data={data} act={act}
        tasks={data.tasks.filter(t=>t.status==='active'&&t.isSomeday)} onOpen={(id)=>{setOverlay(null);openTask(id);}} onClose={()=>setOverlay(null)} />}
      {overlay==='contexts' && <ContextsSheet data={data} onPick={(id)=>setOverlay('ctx:'+id)} onClose={()=>setOverlay(null)} />}
      {overlay && overlay.startsWith('ctx:') && (()=>{ const c=data.contexts.find(x=>x.id===overlay.slice(4));
        return <ListSheet title={c?.name||'Contexto'} data={data} act={act}
          tasks={data.tasks.filter(t=>t.status==='active'&&t.contextId===c?.id)} onOpen={(id)=>{setOverlay(null);openTask(id);}} onClose={()=>setOverlay(null)} />; })()}
      {overlay && overlay.startsWith('area:') && (()=>{ const a=data.areas.find(x=>x.id===overlay.slice(5));
        return <ListSheet title={a?.name||'Área'} data={data} act={act}
          tasks={data.tasks.filter(t=>t.status==='active'&&t.areaId===a?.id)} onOpen={(id)=>{setOverlay(null);openTask(id);}} onClose={()=>setOverlay(null)} />; })()}
      {overlay && overlay.startsWith('project:') && (()=>{ const p=data.projects.find(x=>x.id===overlay.slice(8));
        return <ListSheet title={p?.name||'Proyecto'} data={data} act={act}
          tasks={data.tasks.filter(t=>t.projectId===p?.id&&t.status!=='deleted')} onOpen={(id)=>{setOverlay(null);openTask(id);}} onClose={()=>setOverlay(null)} />; })()}

      {editingArea && <AreaForm area={editingArea?.id ? editingArea : null}
        onSave={(o)=>{ editingArea.id ? act.updateArea(o) : act.createArea(o); }}
        onDelete={act.deleteArea} onClose={()=>setEditingArea(null)} />}
      {editingCtx && <ContextForm ctx={editingCtx?.id ? editingCtx : null}
        onSave={(o)=>{ editingCtx.id ? act.updateContext(o) : act.createContext(o); }}
        onDelete={act.deleteContext} onClose={()=>setEditingCtx(null)} />}
      {editingProject && <ProjectForm project={editingProject?.id ? editingProject : null} areas={data.areas}
        onSave={(o)=>{ editingProject.id ? act.updateProject(o) : act.createProject(o); }}
        onComplete={act.completeProject} onDelete={act.deleteProject} onClose={()=>setEditingProject(null)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
