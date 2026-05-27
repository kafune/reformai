/* global React */

// ============================================================
// ReformAI — Error Handling · Full-page / Auth states
// ============================================================
// Cobre: 404, 500, 401 sessão expirada, Offline (PWA),
// Manutenção programada, Conta desativada / Tenant inativo
// ============================================================

// ── Shell estrutural compartilhado ──────────────────────────
function ErrorShell({ code, codeTone = 'ink', children, asideTone = 'green', aside, footer }) {
  // codeTone: ink | iron | clay | ochre | azulejo | violet | green
  const cMap = {
    ink:     ['var(--rai-ink-900)', 'var(--rai-bone-100)'],
    iron:    ['var(--rai-iron-700)', 'var(--rai-iron-100)'],
    clay:    ['var(--rai-clay-600)', 'var(--rai-clay-100)'],
    ochre:   ['var(--rai-ochre-700)', 'var(--rai-ochre-100)'],
    azulejo: ['var(--rai-azulejo-700)', 'var(--rai-azulejo-100)'],
    violet:  ['var(--rai-violet-600)', 'var(--rai-violet-100)'],
    green:   ['var(--rai-green-800)', 'var(--rai-green-100)'],
  };
  const [fg, bg] = cMap[codeTone];
  return (
    <div className="rai" style={{
      width: '100%', height: '100%',
      display: 'grid', gridTemplateColumns: '1.1fr 1fr',
      background: 'var(--rai-bone-50)',
    }}>
      <div style={{ padding: '56px 72px 40px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <RAILogo size={28} variant="lockup" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 520 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <span className="rai-mono" style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 2,
              background: bg, color: fg, letterSpacing: '.14em', fontWeight: 500,
            }}>ERR · {code}</span>
          </div>
          {children}
        </div>
        <div className="rai-mono" style={{ fontSize: 10, color: 'var(--rai-ink-400)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
          <span>ReformAI · plataforma técnico-operacional</span>
          <span>{footer || 'reformai.app/status'}</span>
        </div>
      </div>
      <div style={{ background: asideTone === 'ink' ? 'var(--rai-ink-900)' : 'var(--rai-green-900)', color: 'var(--rai-bone-50)', position: 'relative', overflow: 'hidden' }}>
        {aside}
      </div>
    </div>
  );
}

// ── 1 · 404 — Página não encontrada ─────────────────────────
function Err404Page() {
  return (
    <ErrorShell code="404 · NOT_FOUND" aside={<Err404Aside/>}>
      <h1 style={{ margin: 0, fontSize: 'var(--rai-fs-4xl)', fontWeight: 600, letterSpacing: 'var(--rai-tracking-tight)', lineHeight: 1.05 }}>
        Esta página não consta<br/>na planta do canteiro.
      </h1>
      <p style={{ marginTop: 18, fontSize: 'var(--rai-fs-md)', color: 'var(--rai-ink-500)', maxWidth: 460, lineHeight: 1.55 }}>
        O endereço que você acessou não existe ou foi movido. Verifique o link ou volte
        para um dos pontos abaixo.
      </p>
      <div style={{ marginTop: 28, display: 'flex', gap: 10 }}>
        <RAIButton variant="primary" size="lg" icon="home">Ir para o início</RAIButton>
        <RAIButton variant="secondary" size="lg" icon="arrowL">Voltar uma página</RAIButton>
      </div>
      <div style={{ marginTop: 36, paddingTop: 20, borderTop: '1px solid var(--rai-divider)' }}>
        <div className="rai-eyebrow" style={{ marginBottom: 12 }}>Talvez você queira</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            ['list', 'Minhas reformas', '/cases'],
            ['doc', 'Documentos', '/cases/.../documents'],
            ['user', 'Meu perfil', '/account'],
            ['info', 'Central de ajuda', '/help'],
          ].map(([icon, label, path]) => (
            <a key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 'var(--rai-r-sm)', background: '#fff', boxShadow: '0 0 0 1px var(--rai-border)', textDecoration: 'none', color: 'var(--rai-ink-700)' }}>
              <Icon name={icon} size={14} color="var(--rai-green-700)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                <div className="rai-mono" style={{ fontSize: 10, color: 'var(--rai-ink-400)', letterSpacing: '.04em' }}>{path}</div>
              </div>
              <Icon name="arrow" size={13} color="var(--rai-ink-300)" />
            </a>
          ))}
        </div>
      </div>
    </ErrorShell>
  );
}

// Aside: 404 visual — large mono "404" with construction grid
function Err404Aside() {
  return (
    <>
      <svg style={{ position: 'absolute', inset: 0 }} width="100%" height="100%" viewBox="0 0 600 800" preserveAspectRatio="none" fill="none">
        <defs>
          <pattern id="grid404" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" stroke="var(--rai-green-700)" strokeWidth="0.5" opacity=".35"/>
          </pattern>
        </defs>
        <rect width="600" height="800" fill="url(#grid404)"/>
        <line x1="0" y1="400" x2="600" y2="400" stroke="var(--rai-green-400)" strokeWidth=".5" opacity=".5"/>
        <line x1="300" y1="0"   x2="300" y2="800" stroke="var(--rai-green-400)" strokeWidth=".5" opacity=".5"/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 56 }}>
        <div className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-green-300)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
          Mapa do site · não localizado
        </div>
        <div style={{ fontFamily: 'var(--rai-font-mono)', fontSize: 260, fontWeight: 500, color: 'var(--rai-green-300)', letterSpacing: '-0.06em', lineHeight: .9, alignSelf: 'center', display: 'flex', alignItems: 'baseline', gap: 0 }}>
          <span>4</span>
          <span style={{ position: 'relative', display: 'inline-block', width: '0.7em' }}>
            <span style={{ position: 'absolute', inset: 0, color: 'var(--rai-green-600)' }}>0</span>
            <svg style={{ position: 'absolute', inset: 0 }} viewBox="0 0 100 140" fill="none"><line x1="10" y1="130" x2="90" y2="10" stroke="var(--rai-clay-400)" strokeWidth="3" /></svg>
          </span>
          <span>4</span>
        </div>
        <div className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-green-300)', letterSpacing: '.14em', textTransform: 'uppercase', textAlign: 'right' }}>
          GET · Rota inexistente<br/><span style={{ opacity: .55 }}>req: 0x4a · 02:14:38</span>
        </div>
      </div>
    </>
  );
}

function Page404() { return null; }

// ── 2 · 500 — Erro inesperado (Next.js error boundary) ─────
function Err500Page() {
  return (
    <ErrorShell code="500 · INTERNAL" codeTone="iron"
      aside={<Err500Aside/>}>
      <h1 style={{ margin: 0, fontSize: 'var(--rai-fs-4xl)', fontWeight: 600, letterSpacing: 'var(--rai-tracking-tight)', lineHeight: 1.05 }}>
        Algo travou no nosso lado.
      </h1>
      <p style={{ marginTop: 18, fontSize: 'var(--rai-fs-md)', color: 'var(--rai-ink-500)', maxWidth: 460, lineHeight: 1.55 }}>
        Registramos a falha e nossa equipe já foi notificada. Seu progresso no caso
        está salvo — nenhuma transição foi efetuada.
      </p>
      <div style={{ marginTop: 24, padding: '14px 16px', background: '#fff', borderRadius: 'var(--rai-r-sm)', boxShadow: '0 0 0 1px var(--rai-border)' }}>
        <div className="rai-eyebrow" style={{ marginBottom: 8 }}>Diagnóstico</div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 6, fontFamily: 'var(--rai-font-mono)', fontSize: 12 }}>
          <span style={{ color: 'var(--rai-ink-400)' }}>request-id</span>
          <span style={{ color: 'var(--rai-ink-900)' }}>req_8f3c1d2a9b</span>
          <span style={{ color: 'var(--rai-ink-400)' }}>timestamp</span>
          <span style={{ color: 'var(--rai-ink-900)' }}>2026-05-25T14:08:32Z</span>
          <span style={{ color: 'var(--rai-ink-400)' }}>endpoint</span>
          <span style={{ color: 'var(--rai-ink-900)' }}>POST /api/v1/cases/.../reports/generate</span>
          <span style={{ color: 'var(--rai-ink-400)' }}>tenant</span>
          <span style={{ color: 'var(--rai-ink-900)' }}>demo</span>
        </div>
      </div>
      <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
        <RAIButton variant="primary" size="lg" iconRight="arrow">Tentar novamente</RAIButton>
        <RAIButton variant="ghost" size="lg" icon="paperclip">Copiar ID do erro</RAIButton>
      </div>
      <div style={{ marginTop: 24, fontSize: 12, color: 'var(--rai-ink-400)', lineHeight: 1.55 }}>
        Persistindo o problema, abra um chamado com este ID em <a style={{ color: 'var(--rai-ink-700)', textDecoration: 'underline' }}>suporte@reformai.app</a>.
      </div>
    </ErrorShell>
  );
}
function Err500Aside() {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-iron-300)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
        Stack · falha registrada
      </div>
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 14, alignItems: 'flex-start' }}>
          {[
            ['client', 'request received', 'ok'],
            ['middleware', 'auth verified', 'ok'],
            ['handler', 'POST /reports/generate', 'ok'],
            ['useCase', 'GenerateReportUseCase', 'ok'],
            ['agent', 'ClaudeReportAgent.complete()', 'thrown'],
            ['response', 'handleError → 500 INTERNAL', 'caught'],
          ].map(([k, v, s], i) => (
            <React.Fragment key={k}>
              <span style={{ width: 8, height: 8, marginTop: 6, borderRadius: '50%', background: s === 'thrown' ? 'var(--rai-iron-500)' : s === 'caught' ? 'var(--rai-ochre-500)' : 'var(--rai-green-400)' }} />
              <div style={{ paddingBottom: 8, borderBottom: i < 5 ? '1px dashed rgba(245,240,228,.15)' : 'none' }}>
                <div className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-bone-300)', letterSpacing: '.05em' }}>{k}</div>
                <div className="rai-mono" style={{ fontSize: 13, color: s === 'thrown' ? 'var(--rai-iron-300)' : 'var(--rai-bone-50)' }}>{v}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'rgba(245,240,228,.06)', borderRadius: 'var(--rai-r-sm)' }}>
        <Icon name="shield" size={16} color="var(--rai-green-300)" />
        <div style={{ fontSize: 12, color: 'var(--rai-ink-200)', lineHeight: 1.5 }}>
          Nenhuma transição de estado foi aplicada. O caso permanece em seu último status válido.
        </div>
      </div>
    </div>
  );
}

// ── 3 · 401 — Sessão expirada (modal centralizado) ─────────
function Err401Session() {
  return (
    <div className="rai" style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--rai-bone-50)', overflow: 'hidden' }}>
      {/* dimmed app behind */}
      <div style={{ position: 'absolute', inset: 0, opacity: .35, filter: 'grayscale(.4) blur(.5px)', pointerEvents: 'none' }}>
        <AppChrome persona="morador" activeNav="cases" tenantLabel="Ed. Jardim Higienópolis">
          <TopBar title="Documentos" subtitle="Memorial, projeto e autorização" breadcrumb={['Minhas reformas', '2026-A-0184']} actions={<RAIButton variant="primary" icon="upload">Enviar documento</RAIButton>} />
          <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <RAICard><div style={{ height: 200 }}/></RAICard>
            <RAICard><div style={{ height: 200 }}/></RAICard>
          </div>
        </AppChrome>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--rai-overlay)' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 480, background: '#fff', borderRadius: 'var(--rai-r-md)', boxShadow: 'var(--rai-shadow-4)', overflow: 'hidden' }}>
        <div style={{ height: 4, background: 'var(--rai-ochre-500)' }} />
        <div style={{ padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span className="rai-mono" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 2, background: 'var(--rai-ochre-100)', color: 'var(--rai-ochre-700)', letterSpacing: '.14em' }}>ERR · 401 · UNAUTHORIZED</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 'var(--rai-fs-2xl)', fontWeight: 600, letterSpacing: 'var(--rai-tracking-snug)' }}>Sessão expirada</h2>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--rai-ink-500)', lineHeight: 1.55 }}>
            Por segurança, sessões inativas são encerradas após 8h. Faça login novamente para continuar — os formulários em aberto foram salvos.
          </p>
          <div style={{ marginTop: 18, padding: 12, background: 'var(--rai-bone-100)', borderRadius: 'var(--rai-r-sm)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <RAIAvatar name="Maria Oliveira" color="var(--rai-clay-500)" size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Maria Oliveira</div>
              <div style={{ fontSize: 12, color: 'var(--rai-ink-500)' }}>maria.oliveira@example.com · Apto. 1204</div>
            </div>
          </div>
          <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <RAIButton variant="ghost">Sair</RAIButton>
            <RAIButton variant="primary" iconRight="arrow">Continuar como Maria</RAIButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 4 · Offline · PWA mobile ────────────────────────────────
function ErrOfflinePWA() {
  return (
    <div className="rai" style={{ width:'100%', height:'100%', background:'var(--rai-bone-50)', display:'flex', alignItems:'center', justifyContent:'center', padding: 32 }}>
      {/* phone bezel */}
      <div style={{ width: 390, height: 780, background:'#0F1310', borderRadius: 44, padding: 10, boxShadow: 'var(--rai-shadow-4)' }}>
        <div style={{ width:'100%', height:'100%', background:'var(--rai-bone-50)', borderRadius: 36, overflow:'hidden', position:'relative' }}>
          {/* notch */}
          <div style={{ position:'absolute', top:8, left:'50%', transform:'translateX(-50%)', width:120, height:28, background:'#0F1310', borderRadius:18, zIndex: 2 }}/>
          {/* status bar */}
          <div style={{ padding: '14px 24px 0', display:'flex', justifyContent:'space-between', fontSize: 13, fontWeight: 600, color:'var(--rai-ink-900)' }}>
            <span>09:42</span>
            <span style={{ display:'inline-flex', gap: 6, alignItems:'center' }}>
              <Icon name="alert" size={14} color="var(--rai-clay-600)"/> Sem sinal
            </span>
          </div>
          <div style={{ padding: '40px 24px', display:'flex', flexDirection:'column', height:'100%' }}>
            <RAILogo size={22} variant="lockup"/>
            <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'flex-start', gap: 14, marginTop: -40 }}>
              <span className="rai-mono" style={{ fontSize: 10, padding:'3px 8px', borderRadius: 2, background:'var(--rai-clay-100)', color:'var(--rai-clay-600)', letterSpacing:'.14em' }}>OFFLINE · MODO CAMPO</span>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing:'var(--rai-tracking-tight)', lineHeight: 1.1 }}>
                Sem conexão.<br/>Continue sua vistoria.
              </h2>
              <p style={{ margin: 0, fontSize: 14, color:'var(--rai-ink-500)', lineHeight: 1.55 }}>
                Fotos e anotações ficam salvas no dispositivo. Tudo sincroniza assim que a rede voltar — você não precisa fazer nada.
              </p>
              <div style={{ marginTop: 8, width:'100%', padding: 14, background:'#fff', borderRadius:'var(--rai-r-sm)', boxShadow:'0 0 0 1px var(--rai-border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
                  <span className="rai-eyebrow">Aguardando upload</span>
                  <span className="rai-mono" style={{ fontSize: 11, color:'var(--rai-ink-500)' }}>4 itens · 3.2 MB</span>
                </div>
                {[
                  ['Vistoria inicial · 12 fotos', 'há 14 min', 'green'],
                  ['Nota técnica · prumada', 'há 8 min', 'green'],
                  ['Vistoria final · 6 fotos', 'há 2 min', 'ochre'],
                ].map(([t, ts, tone], i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding:'8px 0', borderTop: i>0 ? '1px solid var(--rai-divider)' : 'none' }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:`var(--rai-${tone}-500)` }}/>
                    <span style={{ flex:1, fontSize: 13, color:'var(--rai-ink-700)' }}>{t}</span>
                    <span className="rai-mono" style={{ fontSize: 10, color:'var(--rai-ink-400)' }}>{ts}</span>
                  </div>
                ))}
              </div>
              <RAIButton variant="secondary" size="md" icon="upload" style={{ width:'100%' }}>Tentar sincronizar</RAIButton>
            </div>
            <div className="rai-mono" style={{ fontSize: 10, color:'var(--rai-ink-400)', letterSpacing:'.08em', textAlign:'center', textTransform:'uppercase' }}>
              4 alterações locais · backup automático ativo
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 5 · Manutenção programada ───────────────────────────────
function ErrMaintenance() {
  return (
    <div className="rai" style={{ width:'100%', height:'100%', background:'var(--rai-ink-900)', color:'var(--rai-bone-50)', position:'relative', overflow:'hidden', padding: '64px 80px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
      <svg style={{ position:'absolute', right:-100, top:-100, opacity:.10 }} width="700" height="700" viewBox="0 0 700 700">
        <circle cx="350" cy="350" r="340" stroke="var(--rai-green-300)" strokeWidth="1" fill="none"/>
        <circle cx="350" cy="350" r="240" stroke="var(--rai-green-300)" strokeWidth="1" fill="none"/>
        <circle cx="350" cy="350" r="140" stroke="var(--rai-green-300)" strokeWidth="1" fill="none"/>
        <path d="M70 350 Q350 70 630 350" stroke="var(--rai-ochre-400)" strokeWidth="1.5" fill="none"/>
      </svg>

      <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <RAILogo size={32} variant="lockup" color="var(--rai-bone-50)" accent="var(--rai-green-300)"/>
        <span className="rai-mono" style={{ fontSize: 11, padding:'4px 10px', borderRadius: 2, background:'var(--rai-ochre-700)', color:'var(--rai-bone-50)', letterSpacing:'.14em' }}>MNT · 503 · SERVICE_UNAVAILABLE</span>
      </div>

      <div style={{ position:'relative', maxWidth: 820 }}>
        <div className="rai-eyebrow" style={{ color:'var(--rai-ochre-300)' }}>Manutenção programada · janela técnica</div>
        <h1 style={{ margin: '14px 0 18px', fontSize: 'var(--rai-fs-5xl)', fontWeight: 600, letterSpacing:'var(--rai-tracking-tight)', lineHeight: 1, color:'var(--rai-bone-50)' }}>
          Em obras —<br/>
          <span style={{ color:'var(--rai-green-300)' }}>voltamos às 03:00.</span>
        </h1>
        <p style={{ fontSize: 'var(--rai-fs-md)', color:'var(--rai-ink-200)', lineHeight: 1.6, maxWidth: 620 }}>
          Estamos aplicando uma atualização no motor de regras (versão 1.4 → 1.5).
          Durante a janela, novas triagens estão pausadas. Casos em execução não são afetados.
        </p>

        <div style={{ marginTop: 32, display: 'flex', gap: 28, alignItems: 'flex-end' }}>
          {[
            ['00','dias'], ['02','horas'], ['17','min'], ['42','seg'],
          ].map(([v, l], i) => (
            <React.Fragment key={i}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:'var(--rai-font-mono)', fontSize: 'var(--rai-fs-5xl)', fontWeight: 500, color:'var(--rai-bone-50)', letterSpacing:'-0.04em', lineHeight: 1 }}>{v}</div>
                <div className="rai-mono" style={{ marginTop: 6, fontSize: 11, color:'var(--rai-ink-300)', letterSpacing:'.14em', textTransform:'uppercase' }}>{l}</div>
              </div>
              {i < 3 && <div style={{ fontFamily:'var(--rai-font-mono)', fontSize: 'var(--rai-fs-4xl)', color:'var(--rai-ink-400)', lineHeight: 1, paddingBottom: 22 }}>:</div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ position:'relative', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 20 }}>
        {[
          ['Pausado', 'Triagem · novos casos · análise documental', 'ochre'],
          ['Disponível', 'Vistorias de campo · upload via PWA · histórico', 'green'],
          ['Status oficial', 'status.reformai.app/incident/m-2026-05-25', 'azulejo'],
        ].map(([t, d, tone], i) => (
          <div key={i} style={{ padding: 18, background:'rgba(245,240,228,.06)', borderRadius:'var(--rai-r-sm)', borderLeft:`3px solid var(--rai-${tone}-500)` }}>
            <div className="rai-mono" style={{ fontSize: 10, color:`var(--rai-${tone}-300)`, letterSpacing:'.14em', textTransform:'uppercase' }}>{t}</div>
            <div style={{ marginTop: 6, fontSize: 13, color:'var(--rai-bone-50)', lineHeight: 1.5 }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 6 · Conta desativada / Tenant inativo ──────────────────
function ErrAccountInactive() {
  return (
    <ErrorShell code="403 · ACCOUNT_INACTIVE" codeTone="clay"
      aside={<ErrAccountAside/>}>
      <h1 style={{ margin: 0, fontSize: 'var(--rai-fs-3xl)', fontWeight: 600, letterSpacing: 'var(--rai-tracking-tight)', lineHeight: 1.1 }}>
        Sua conta foi desativada<br/>pelo administrador.
      </h1>
      <p style={{ marginTop: 18, fontSize: 'var(--rai-fs-md)', color: 'var(--rai-ink-500)', maxWidth: 460, lineHeight: 1.55 }}>
        Você consegue ver, mas não consegue mais criar casos, enviar documentos ou aceitar atribuições.
        Casos antigos permanecem visíveis em modo de leitura.
      </p>
      <div style={{ marginTop: 26, padding: 18, background: '#fff', borderRadius: 'var(--rai-r-md)', boxShadow: '0 0 0 1px var(--rai-border)' }}>
        <div style={{ display:'flex', gap: 14, alignItems:'center' }}>
          <RAIAvatar name="Ana Pires" color="var(--rai-violet-500)" size={44}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Eng. Ana Pires</div>
            <div className="rai-mono" style={{ fontSize: 12, color:'var(--rai-ink-500)' }}>parceiro@demo.com · PARTNER · CREA-SP 123.456</div>
          </div>
          <RAIBadge tone="clay" dot>Inativa</RAIBadge>
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop:'1px solid var(--rai-divider)', display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 6, fontSize: 12 }}>
          <span style={{ color:'var(--rai-ink-400)' }}>desativada em</span>
          <span className="rai-mono">2026-05-23 · 14:08</span>
          <span style={{ color:'var(--rai-ink-400)' }}>por</span>
          <span>João Souza · ADMIN</span>
          <span style={{ color:'var(--rai-ink-400)' }}>motivo</span>
          <span style={{ color:'var(--rai-ink-700)' }}>Solicitação interna — revisão de cadastro CREA.</span>
        </div>
      </div>
      <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
        <RAIButton variant="primary" size="lg" icon="send">Falar com o admin</RAIButton>
        <RAIButton variant="ghost" size="lg">Sair da conta</RAIButton>
      </div>
    </ErrorShell>
  );
}
function ErrAccountAside() {
  return (
    <div style={{ position:'absolute', inset: 0, padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-green-300)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
        Permissões · estado atual
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {[
          ['Ver casos atribuídos', true, 'somente leitura'],
          ['Ver vistorias agendadas', true, 'somente leitura'],
          ['Histórico de relatórios', true, 'download disponível'],
          ['Aceitar / recusar caso', false, 'bloqueado · 403'],
          ['Agendar vistoria', false, 'bloqueado · 403'],
          ['Enviar ART/RRT final', false, 'bloqueado · 403'],
        ].map(([t, ok, hint], i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 12, alignItems: 'center', padding: '12px 14px', background:'rgba(245,240,228,.06)', borderRadius:'var(--rai-r-sm)' }}>
            <span style={{ width: 16, height: 16, borderRadius: 3, background: ok ? 'var(--rai-green-500)' : 'var(--rai-iron-500)', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
              <Icon name={ok ? 'check' : 'close'} size={11} color="white"/>
            </span>
            <span style={{ fontSize: 13, color: 'var(--rai-bone-50)' }}>{t}</span>
            <span className="rai-mono" style={{ fontSize: 11, color: ok ? 'var(--rai-green-300)' : 'var(--rai-iron-300)' }}>{hint}</span>
          </div>
        ))}
      </div>
      <div className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-bone-300)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
        tenant · demo · STANDALONE · ativo
      </div>
    </div>
  );
}

Object.assign(window, {
  ErrorShell,
  Err404Page, Err404Aside,
  Err500Page, Err500Aside,
  Err401Session,
  ErrOfflinePWA,
  ErrMaintenance,
  ErrAccountInactive, ErrAccountAside,
});
