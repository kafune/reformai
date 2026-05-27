/* global React */

// ============================================================
// ReformAI — Error Handling · In-app & inline states
// ============================================================
// Cobre: 403 (role), 404 caso (tenant-isolation),
// Transição inválida (state machine), Regra de negócio violada,
// IA indisponível, Upload falhou, Análise documental falhou,
// Link expirado, Validação Zod
// ============================================================

// ── 7 · 403 — Acesso negado por papel (in-app) ──────────────
function Err403Role() {
  return (
    <AppChrome persona="morador" activeNav="home" tenantLabel="Ed. Jardim Higienópolis">
      <TopBar
        breadcrumb={['Painel', 'Fila de revisão']}
        title="Fila de revisão"
        subtitle="Triagem assistida pelo motor de regras"
      />
      <div style={{ padding: '40px 32px', overflow: 'auto', flex: 1 }}>
        <div style={{ maxWidth: 720, margin: '40px auto 0' }}>
          {/* code badge */}
          <span className="rai-mono" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 2, background: 'var(--rai-iron-100)', color: 'var(--rai-iron-700)', letterSpacing: '.14em' }}>
            ERR · 403 · FORBIDDEN
          </span>
          <h1 style={{ margin: '20px 0 8px', fontSize: 'var(--rai-fs-3xl)', fontWeight: 600, letterSpacing: 'var(--rai-tracking-tight)' }}>
            Você não tem acesso a esta área.
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--rai-fs-md)', color: 'var(--rai-ink-500)', lineHeight: 1.55, maxWidth: 600 }}>
            A <b>Fila de revisão</b> é restrita ao papel <span className="rai-mono" style={{ background: 'var(--rai-bone-100)', padding: '1px 6px', borderRadius: 3, fontSize: 13 }}>ADMIN</span> ou superior.
            Seu papel atual é <span className="rai-mono" style={{ background: 'var(--rai-bone-100)', padding: '1px 6px', borderRadius: 3, fontSize: 13 }}>CLIENT</span>.
          </p>

          {/* Role ladder */}
          <div style={{ marginTop: 28, padding: 24, background: '#fff', borderRadius: 'var(--rai-r-md)', boxShadow: '0 0 0 1px var(--rai-border)' }}>
            <div className="rai-eyebrow">Hierarquia · seu acesso</div>
            <div style={{ marginTop: 18, display: 'grid', gap: 6 }}>
              {[
                ['SUPER_ADMIN', 'Acesso global · todos os tenants', false],
                ['ADMIN',       'Administra o tenant — fila de revisão, políticas, parceiros', false],
                ['MANAGER',     'Gestor do tenant — operação e relatórios', false],
                ['CONDOMINIUM', 'Síndico — casos do condomínio', false],
                ['CLIENT',      'Morador — apenas seus próprios casos', true],
                ['PARTNER',     'Engenheiro/arquiteto parceiro — casos atribuídos', false],
              ].map(([role, desc, current], i) => (
                <div key={role} style={{
                  display: 'grid', gridTemplateColumns: '140px 1fr 24px', gap: 16, alignItems: 'center',
                  padding: '10px 14px', borderRadius: 'var(--rai-r-sm)',
                  background: current ? 'var(--rai-clay-100)' : 'transparent',
                  border: current ? '1px solid var(--rai-clay-400)' : '1px solid transparent',
                }}>
                  <span className="rai-mono" style={{ fontSize: 12, fontWeight: 500, color: current ? 'var(--rai-clay-600)' : 'var(--rai-ink-700)', letterSpacing: '.04em' }}>{role}</span>
                  <span style={{ fontSize: 13, color: current ? 'var(--rai-clay-600)' : 'var(--rai-ink-500)' }}>{desc}</span>
                  {current && <Icon name="arrowL" size={14} color="var(--rai-clay-600)"/>}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
            <RAIButton variant="primary" icon="home">Ir para minhas reformas</RAIButton>
            <RAIButton variant="ghost" icon="send">Pedir acesso ao admin</RAIButton>
          </div>

          <div style={{ marginTop: 20, padding: 14, background: 'var(--rai-bone-100)', borderRadius: 'var(--rai-r-sm)', display: 'flex', gap: 12, fontSize: 12, color: 'var(--rai-ink-500)', lineHeight: 1.55 }}>
            <Icon name="info" size={14} color="var(--rai-ink-500)"/>
            <span>Esta tentativa foi registrada em <span className="rai-mono">AuditLog</span> · action <span className="rai-mono">auth.forbidden</span> · req_44a8b1c.</span>
          </div>
        </div>
      </div>
    </AppChrome>
  );
}

// ── 8 · 404 — Caso não encontrado (tenant-isolation safe) ──
function Err404Case() {
  return (
    <AppChrome persona="sindico" activeNav="cases" tenantLabel="Ed. Jardim Higienópolis">
      <TopBar
        breadcrumb={['Casos do condomínio', '2026-A-9999']}
        title="Caso não localizado"
      />
      <div style={{ padding: '40px 32px', overflow: 'auto', flex: 1 }}>
        <div style={{ maxWidth: 880, margin: '8px auto 0', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
          {/* Main */}
          <div>
            <span className="rai-mono" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 2, background: 'var(--rai-bone-200)', color: 'var(--rai-ink-700)', letterSpacing: '.14em' }}>
              ERR · 404 · NOT_FOUND · ReformCase
            </span>
            <h1 style={{ margin: '20px 0 8px', fontSize: 'var(--rai-fs-2xl)', fontWeight: 600, letterSpacing: 'var(--rai-tracking-snug)' }}>
              O caso <span className="rai-mono" style={{ background: 'var(--rai-bone-100)', padding: '2px 8px', borderRadius: 3 }}>2026-A-9999</span> não existe neste condomínio.
            </h1>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--rai-ink-500)', lineHeight: 1.55 }}>
              Verifique o número do protocolo. Casos de outros condomínios e tenants
              não aparecem aqui por isolamento — mesmo que o identificador exista em outro lugar.
            </p>

            <div style={{ background: '#fff', borderRadius: 'var(--rai-r-md)', boxShadow: '0 0 0 1px var(--rai-border)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rai-divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="rai-eyebrow">Casos próximos</div>
                <span className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-ink-400)' }}>3 sugestões</span>
              </div>
              {[
                ['2026-A-0184', 'Apto. 1204 · Reforma de cozinha', 'HUMAN_REVIEW_REQUIRED', 'review'],
                ['2026-A-0212', 'Apto. 802 · Troca de piso',       'ELIGIBLE_FOR_RELEASE',  'ok'],
                ['2026-A-0203', 'Cob. 2001 · Impermeabilização',    'PENDING_CORRECTIONS',   'attention'],
              ].map(([p, u, s, fam], i) => (
                <div key={p} style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 16, alignItems: 'center', padding: '14px 18px', borderTop: i > 0 ? '1px solid var(--rai-divider)' : 'none' }}>
                  <span className="rai-mono" style={{ fontSize: 12, color: 'var(--rai-ink-700)', letterSpacing: '.04em' }}>{p}</span>
                  <span style={{ fontSize: 13, color: 'var(--rai-ink-700)' }}>{u}</span>
                  <StatusChip status={s}/>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
              <RAIInput placeholder="Buscar por protocolo · ex.: 2026-A-0184" icon="search" mono />
              <RAIButton variant="primary" size="md">Buscar</RAIButton>
            </div>
          </div>

          {/* Side — Why */}
          <aside style={{ padding: 18, background: 'var(--rai-azulejo-100)', borderRadius: 'var(--rai-r-md)', borderLeft: '3px solid var(--rai-azulejo-500)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name="info" size={14} color="var(--rai-azulejo-700)" />
              <span className="rai-mono" style={{ fontSize: 10, color: 'var(--rai-azulejo-700)', letterSpacing: '.14em', textTransform: 'uppercase' }}>Por que 404 e não 403?</span>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--rai-azulejo-700)', lineHeight: 1.6 }}>
              Quando o caso existe em outro tenant, retornamos <span className="rai-mono">404</span> e não <span className="rai-mono">403</span> —
              isso evita vazar a existência de recursos entre clientes. Toda query
              é filtrada por <span className="rai-mono">tenantId</span> antes de qualquer verificação.
            </p>
            <div style={{ marginTop: 14, padding: 12, background: 'rgba(255,255,255,.6)', borderRadius: 'var(--rai-r-xs)' }}>
              <div className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-azulejo-700)', lineHeight: 1.6 }}>
                {`if (case.tenantId !== user.tenantId)`}<br/>
                {`  throw new NotFoundError(...)`}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppChrome>
  );
}

// ── 9 · Transição inválida (state machine) ──────────────────
function ErrInvalidTransition() {
  return (
    <AppChrome persona="sindico" activeNav="cases" tenantLabel="Ed. Jardim Higienópolis">
      <TopBar
        breadcrumb={['Casos do condomínio', '2026-A-0184']}
        title="Apto. 1204 · Reforma de cozinha"
        subtitle="Protocolo 2026-A-0184 · Maria Oliveira · CRITICAL"
        actions={<RAIButton variant="secondary" icon="paperclip">Histórico</RAIButton>}
      />
      <div style={{ padding: 32, overflow: 'hidden', flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, position: 'relative' }}>
        {/* Behind: case detail */}
        <div style={{ background: '#fff', borderRadius: 'var(--rai-r-md)', boxShadow: '0 0 0 1px var(--rai-border)', padding: 24, opacity: .35, filter: 'grayscale(.3)' }}>
          <div className="rai-eyebrow">Resumo</div>
          <h2 style={{ marginTop: 6 }}>Caso CRITICAL · 4 regras acionadas</h2>
          <div style={{ marginTop: 18 }}><StatusChip status="ART_RRT_PENDING"/></div>
          <div style={{ marginTop: 24, height: 200, background: 'var(--rai-bone-100)', borderRadius: 'var(--rai-r-sm)' }}/>
        </div>
        <div style={{ opacity: .35 }}>
          <RAICard><div style={{ height: 280 }}/></RAICard>
        </div>

        {/* Modal */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 540, background: '#fff', borderRadius: 'var(--rai-r-md)', boxShadow: 'var(--rai-shadow-4)', overflow: 'hidden' }}>
          <div style={{ height: 4, background: 'var(--rai-iron-500)' }}/>
          <div style={{ padding: 28 }}>
            <span className="rai-mono" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 2, background: 'var(--rai-iron-100)', color: 'var(--rai-iron-700)', letterSpacing: '.14em' }}>
              ERR · 422 · INVALID_TRANSITION
            </span>
            <h2 style={{ margin: '16px 0 6px', fontSize: 'var(--rai-fs-xl)', fontWeight: 600, letterSpacing: 'var(--rai-tracking-snug)' }}>
              Esta transição não é permitida pela máquina de estados.
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--rai-ink-500)', lineHeight: 1.55 }}>
              O caso está em <span className="rai-mono" style={{ background: 'var(--rai-bone-100)', padding: '1px 6px', borderRadius: 3 }}>ART_RRT_PENDING</span> e
              só pode avançar para <span className="rai-mono" style={{ background: 'var(--rai-bone-100)', padding: '1px 6px', borderRadius: 3 }}>INSPECTIONS_SCHEDULED</span>.
            </p>

            {/* Transition diagram */}
            <div style={{ marginTop: 22, padding: '20px 16px', background: 'var(--rai-bone-50)', borderRadius: 'var(--rai-r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div className="rai-mono" style={{ fontSize: 10, color: 'var(--rai-ink-400)', letterSpacing: '.1em', marginBottom: 6 }}>DE</div>
                <span style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 'var(--rai-r-pill)', background: 'var(--rai-ochre-100)', color: 'var(--rai-ochre-700)', fontSize: 12, fontWeight: 500 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 6, alignSelf: 'center' }}/>
                  ART_RRT_PENDING
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <Icon name="arrow" size={20} color="var(--rai-iron-500)"/>
                <span style={{ position: 'absolute', top: -3, right: -5, fontSize: 14, color: 'var(--rai-iron-500)', fontWeight: 700 }}>×</span>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div className="rai-mono" style={{ fontSize: 10, color: 'var(--rai-ink-400)', letterSpacing: '.1em', marginBottom: 6 }}>TENTATIVA</div>
                <span style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 'var(--rai-r-pill)', background: 'var(--rai-green-100)', color: 'var(--rai-green-800)', fontSize: 12, fontWeight: 500, textDecoration: 'line-through', opacity: .7 }}>
                  CONCLUDED
                </span>
              </div>
            </div>

            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--rai-bone-100)', borderRadius: 'var(--rai-r-sm)' }}>
              <div className="rai-eyebrow" style={{ marginBottom: 6 }}>Transição válida</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--rai-ink-700)' }}>
                <span className="rai-mono">ART_RRT_PENDING</span>
                <Icon name="arrow" size={12} color="var(--rai-green-700)"/>
                <span className="rai-mono">INSPECTIONS_SCHEDULED</span>
              </div>
            </div>

            <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <RAIButton variant="ghost">Cancelar</RAIButton>
              <RAIButton variant="primary" icon="clock">Agendar vistorias</RAIButton>
            </div>
            <div className="rai-mono" style={{ marginTop: 14, fontSize: 10, color: 'var(--rai-ink-400)', letterSpacing: '.1em' }}>
              CaseStateMachine.transition() · throw InvalidTransitionError
            </div>
          </div>
        </div>
      </div>
    </AppChrome>
  );
}

// ── 10 · Business rule · HIGH/CRITICAL requer revisão ──────
function ErrBusinessRule() {
  return (
    <AppChrome persona="morador" activeNav="cases" tenantLabel="Ed. Jardim Higienópolis">
      <TopBar
        breadcrumb={['Minhas reformas', '2026-A-0184']}
        title="Apto. 1204 · Reforma de cozinha"
        subtitle="Protocolo 2026-A-0184"
        actions={<RAIBadge tone="violet" dot>Revisão humana</RAIBadge>}
      />
      <div style={{ padding: '24px 32px 32px', overflow: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignContent: 'start' }}>
        {/* Block banner */}
        <div style={{ gridColumn: '1 / -1', background: 'var(--rai-violet-100)', border: '1px solid var(--rai-violet-300)', borderRadius: 'var(--rai-r-md)', padding: '18px 22px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--rai-violet-500)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="eye" size={18}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="rai-mono" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 2, background: 'var(--rai-violet-600)', color: '#fff', letterSpacing: '.14em' }}>
                BUSINESS_RULE_VIOLATION
              </span>
              <RiskBadge level="CRITICAL" score={84} size="sm"/>
            </div>
            <h2 style={{ margin: '10px 0 6px', fontSize: 'var(--rai-fs-lg)', fontWeight: 600, color: 'var(--rai-violet-600)', letterSpacing: 'var(--rai-tracking-snug)' }}>
              Casos CRITICAL não vão para liberação sem revisão humana.
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--rai-ink-700)', lineHeight: 1.55, maxWidth: 720 }}>
              Sua reforma envolve <b>impacto estrutural / prumadas</b> — score 84 · risco crítico. Antes
              de qualquer liberação, um técnico do nosso time precisa revisar manualmente
              o caso. Você não precisa fazer nada agora.
            </p>
          </div>
          <RAIButton variant="ghost" size="sm" icon="close" style={{ marginTop: -4 }}>Recolher</RAIButton>
        </div>

        {/* Steps */}
        <div style={{ background: '#fff', borderRadius: 'var(--rai-r-md)', boxShadow: '0 0 0 1px var(--rai-border)', padding: 22 }}>
          <div className="rai-eyebrow">Próximos passos</div>
          <div style={{ marginTop: 16 }}>
            <TransitionTimeline items={[
              { title: 'Escopo classificado', detail: 'Risco CRITICAL · 4 regras acionadas.', by: 'ai', time: '15/05 10:21', tone: 'progress' },
              { title: 'Caso encaminhado para revisão', detail: 'Aguardando técnico do tenant atribuir o caso.', by: 'system', time: '15/05 10:21', tone: 'review', current: true },
              { title: 'Revisão humana', detail: 'Técnico revisa pareceres e decide próximo estado.', tone: 'review' },
              { title: 'Liberação ou correções', detail: 'Resultado: liberado, com ressalvas, ou pendente de correção.', tone: 'progress' },
            ]}/>
          </div>
        </div>

        {/* Why */}
        <aside style={{ padding: 18, background: '#fff', borderRadius: 'var(--rai-r-md)', boxShadow: '0 0 0 1px var(--rai-border)', alignSelf: 'start' }}>
          <div className="rai-eyebrow">Por que esta regra existe</div>
          <p style={{ marginTop: 10, fontSize: 12.5, color: 'var(--rai-ink-700)', lineHeight: 1.6 }}>
            Casos HIGH e CRITICAL têm risco técnico significativo (estrutural, hidráulico,
            gás, fachada). A plataforma <b>nunca</b> libera esses casos sem que uma pessoa
            qualificada do tenant analise.
          </p>
          <div style={{ marginTop: 14, padding: 12, background: 'var(--rai-bone-100)', borderRadius: 'var(--rai-r-xs)' }}>
            <div className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-ink-700)', lineHeight: 1.6 }}>
              if (riskLevel === 'HIGH' ‖ 'CRITICAL'<br/>
              {`    && previousStatus !==`}<br/>
              {`       HUMAN_REVIEW_REQUIRED)`}<br/>
              {`  throw BusinessRuleViolation`}
            </div>
          </div>
          <div className="rai-mono" style={{ marginTop: 12, fontSize: 10, color: 'var(--rai-ink-400)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            CLAUDE.md · §13 · regra #2
          </div>
        </aside>
      </div>
    </AppChrome>
  );
}

// ── 11 · IA temporariamente indisponível (chat fallback) ───
function ErrLLMUnavailable() {
  return (
    <AppChrome persona="morador" activeNav="cases" tenantLabel="Ed. Jardim Higienópolis">
      <TopBar
        breadcrumb={['Minhas reformas', 'Novo caso']}
        title="Conte sua reforma"
        subtitle="A IA está temporariamente fora — você pode seguir manualmente"
        actions={<RAIBadge tone="ochre" dot>IA indisponível</RAIBadge>}
      />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr', padding: 0, background: 'var(--rai-bone-100)', overflow: 'hidden' }}>
        <div style={{ padding: '24px 80px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
          {/* AI status banner */}
          <div style={{ padding: '16px 20px', background: '#fff', borderRadius: 'var(--rai-r-md)', boxShadow: '0 0 0 1px var(--rai-border)', display: 'flex', gap: 14, alignItems: 'flex-start', borderLeft: '3px solid var(--rai-ochre-500)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 'var(--rai-r-sm)', background: 'var(--rai-ochre-100)', color: 'var(--rai-ochre-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="sparkle" size={16}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span className="rai-mono" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 2, background: 'var(--rai-ochre-700)', color: '#fff', letterSpacing: '.14em' }}>LLM · UPSTREAM_UNAVAILABLE</span>
                <span className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-ink-400)' }}>· anthropic · 529</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--rai-ink-900)' }}>Estamos com instabilidade no assistente de IA.</div>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--rai-ink-500)', lineHeight: 1.55 }}>
                O motor de regras (determinístico) continua funcionando normalmente. Você pode preencher
                o escopo manualmente ou aguardar a IA voltar — nada do que você digitou foi perdido.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <RAIButton variant="primary" size="sm" icon="sparkle">Tentar IA novamente</RAIButton>
              <span className="rai-mono" style={{ fontSize: 10, color: 'var(--rai-ink-400)' }}>retry · 12s</span>
            </div>
          </div>

          {/* Chat history (faded last AI bubble) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
            <UserMessage>Vou trocar a prumada hidráulica e os pontos elétricos da cozinha.</UserMessage>
            <div style={{ opacity: .9 }}>
              <AIMessage disclaimer="A plataforma não emite ART/RRT. A emissão formal é responsabilidade do profissional habilitado parceiro.">
                Pelo que você descreveu, sua reforma envolve <b>troca de prumada hidráulica</b> e
                <b> alteração elétrica</b>. Isso classifica o caso como <b>risco alto</b> e exige
                <b> ART</b>. Posso seguir com a checklist?
              </AIMessage>
            </div>
            <UserMessage>Sim, pode seguir.</UserMessage>

            {/* AI bubble in error state */}
            <div style={{ display: 'flex', gap: 12, maxWidth: '85%' }}>
              <div style={{ flex: '0 0 32px', width: 32, height: 32, borderRadius: 'var(--rai-r-sm)', background: 'var(--rai-bone-200)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="alert" size={16} color="var(--rai-ochre-700)"/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--rai-ink-700)' }}>Assistente ReformAI</span>
                  <span className="rai-mono" style={{ fontSize: 10, padding: '1px 6px', background: 'var(--rai-ochre-100)', color: 'var(--rai-ochre-700)', borderRadius: 3 }}>fallback · sem IA</span>
                </div>
                <div style={{ padding: '14px 16px', background: 'var(--rai-bone-50)', border: '1px dashed var(--rai-ochre-400)', borderRadius: '2px 12px 12px 12px', fontSize: 14, lineHeight: 1.55, color: 'var(--rai-ink-700)' }}>
                  Não consegui responder agora. Enquanto a IA volta, você pode <a style={{ color: 'var(--rai-green-700)', textDecoration: 'underline' }}>preencher o escopo no formulário</a> —
                  o resultado é equivalente para a classificação de risco.
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <RAIButton variant="secondary" size="sm" icon="list">Abrir formulário</RAIButton>
                  <RAIButton variant="ghost" size="sm" icon="clock">Avisar quando IA voltar</RAIButton>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1 }}/>
          <div style={{ padding: 14, background: '#fff', borderRadius: 'var(--rai-r-md)', boxShadow: '0 0 0 1px var(--rai-border)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Icon name="chat" size={16} color="var(--rai-ink-400)"/>
            <span style={{ flex: 1, color: 'var(--rai-ink-400)', fontSize: 14 }}>Aguardando IA voltar… você pode digitar mesmo assim</span>
            <RAIButton variant="primary" size="sm" icon="send">Enviar</RAIButton>
          </div>
        </div>
      </div>
    </AppChrome>
  );
}

// ── 12 · Upload falhou (modal sobre página de documentos) ──
function ErrUploadFailed() {
  return (
    <AppChrome persona="morador" activeNav="docs" tenantLabel="Ed. Jardim Higienópolis">
      <TopBar
        breadcrumb={['Minhas reformas', '2026-A-0184', 'Documentos']}
        title="Documentos do caso"
        subtitle="Memorial, projeto e autorização"
      />
      <div style={{ padding: 32, position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* Faded documents grid */}
        <div style={{ opacity: .35, filter: 'grayscale(.3)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[1,2,3,4,5,6].map(i => (
            <RAICard key={i}><div style={{ height: 120 }}/></RAICard>
          ))}
        </div>
        {/* Modal */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 560, background: '#fff', borderRadius: 'var(--rai-r-md)', boxShadow: 'var(--rai-shadow-4)', overflow: 'hidden' }}>
          <div style={{ height: 4, background: 'var(--rai-iron-500)' }}/>
          <div style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <span className="rai-mono" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 2, background: 'var(--rai-iron-100)', color: 'var(--rai-iron-700)', letterSpacing: '.14em' }}>
                  ERR · 413 · UPLOAD_REJECTED
                </span>
                <h2 style={{ margin: '14px 0 4px', fontSize: 'var(--rai-fs-xl)', fontWeight: 600, letterSpacing: 'var(--rai-tracking-snug)' }}>
                  Não consegui enviar 2 arquivos.
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--rai-ink-500)' }}>Outros 3 arquivos foram enviados normalmente.</p>
              </div>
              <Icon name="close" size={18} color="var(--rai-ink-400)"/>
            </div>

            <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
              {[
                ['Memorial.pdf',          '2.1 MB',   'enviado',  'green',  'Documento em fila para análise'],
                ['Projeto-cozinha.dwg',   '34.2 MB',  'rejeitado','iron',   'Tipo .dwg não suportado · envie como PDF'],
                ['Vistoria-1.jpg',        '0.8 MB',   'enviado',  'green',  '—'],
                ['Vistoria-2.jpg',        '0.7 MB',   'enviado',  'green',  '—'],
                ['Planta-baixa.pdf',      '67.4 MB',  'rejeitado','iron',   'Arquivo maior que 50 MB · comprima ou divida'],
              ].map(([name, size, status, tone, hint], i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 70px 90px', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 'var(--rai-r-sm)', background: status === 'rejeitado' ? 'var(--rai-iron-100)' : 'var(--rai-bone-50)' }}>
                  <Icon name="doc" size={14} color={`var(--rai-${tone}-700)`}/>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--rai-ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                    <div style={{ fontSize: 11, color: `var(--rai-${tone}-700)`, marginTop: 1 }}>{hint}</div>
                  </div>
                  <span className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-ink-500)', textAlign: 'right' }}>{size}</span>
                  <span className="rai-mono" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 2, background: `var(--rai-${tone}-${status === 'rejeitado' ? '600' : '600'})`, color: '#fff', letterSpacing: '.14em', textAlign: 'center', textTransform: 'uppercase' }}>{status}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, padding: 12, background: 'var(--rai-bone-100)', borderRadius: 'var(--rai-r-sm)', fontSize: 12, color: 'var(--rai-ink-500)', lineHeight: 1.55 }}>
              Aceitamos <b>PDF, JPG, PNG e DOCX</b> até <b>50 MB</b> cada. Para arquivos CAD/BIM,
              exporte como PDF antes de enviar.
            </div>
            <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <RAIButton variant="ghost">Descartar 2 falhos</RAIButton>
              <RAIButton variant="secondary" icon="upload">Reenviar como PDF</RAIButton>
            </div>
          </div>
        </div>
      </div>
    </AppChrome>
  );
}

// ── 13 · Análise documental falhou (worker error) ──────────
function ErrDocAnalysisFailed() {
  return (
    <AppChrome persona="sindico" activeNav="cases" tenantLabel="Ed. Jardim Higienópolis">
      <TopBar
        breadcrumb={['Casos', '2026-A-0184', 'Memorial.pdf']}
        title="Memorial descritivo · análise"
        subtitle="2.1 MB · enviado há 8 minutos"
        actions={<RAIBadge tone="iron" dot>Falha no worker</RAIBadge>}
      />
      <div style={{ padding: '24px 32px 32px', overflow: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
        {/* Pipeline stages */}
        <div style={{ background: '#fff', borderRadius: 'var(--rai-r-md)', boxShadow: '0 0 0 1px var(--rai-border)', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="rai-eyebrow">Pipeline documental</div>
              <h2 style={{ margin: '6px 0 0', fontSize: 'var(--rai-fs-lg)', fontWeight: 600, letterSpacing: 'var(--rai-tracking-snug)' }}>
                3 de 4 etapas falharam · reprocessamento manual
              </h2>
            </div>
            <span className="rai-mono" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 2, background: 'var(--rai-iron-100)', color: 'var(--rai-iron-700)', letterSpacing: '.14em' }}>
              WORKER · DocumentWorker
            </span>
          </div>

          <div style={{ marginTop: 22, display: 'grid', gap: 0 }}>
            {[
              { stage: '01 · Upload', detail: 'Memorial.pdf · 2.1 MB · MIME ok', status: 'ok', time: '02:14:01' },
              { stage: '02 · OCR (Tesseract)', detail: 'Texto extraído · 4.812 caracteres', status: 'ok', time: '02:14:09' },
              { stage: '03 · Extração estruturada (LLM)', detail: 'Resposta da IA inválida · Zod safeParse falhou em DocumentExtractionResultSchema', status: 'fail', time: '02:14:38' },
              { stage: '04 · Validação de coerência', detail: 'Não executou — etapa 03 falhou', status: 'skip', time: '—' },
              { stage: '05 · Atualizar status do caso', detail: 'Não executou', status: 'skip', time: '—' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '14px 1fr 80px', gap: 14, padding: '14px 0', borderTop: i > 0 ? '1px solid var(--rai-divider)' : 'none', alignItems: 'flex-start' }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%', marginTop: 5,
                  background: s.status === 'ok' ? 'var(--rai-green-500)' : s.status === 'fail' ? 'var(--rai-iron-500)' : 'var(--rai-bone-300)',
                  boxShadow: s.status === 'fail' ? '0 0 0 4px var(--rai-iron-100)' : 'none',
                }}/>
                <div>
                  <div className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-ink-400)', letterSpacing: '.04em' }}>{s.stage}</div>
                  <div style={{ fontSize: 13, color: s.status === 'fail' ? 'var(--rai-iron-700)' : s.status === 'skip' ? 'var(--rai-ink-400)' : 'var(--rai-ink-700)', marginTop: 2, lineHeight: 1.5 }}>{s.detail}</div>
                </div>
                <span className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-ink-400)', textAlign: 'right' }}>{s.time}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22, padding: 14, background: 'var(--rai-iron-100)', borderRadius: 'var(--rai-r-sm)' }}>
            <div className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-iron-700)', letterSpacing: '.08em', lineHeight: 1.6 }}>
              ZodError · path: extracted.area_m2 · expected: number · received: "aproximadamente 18m²"<br/>
              ClaudeDocumentAgent · attempt 1/3 · retry in 30s
            </div>
          </div>

          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <RAIButton variant="primary" icon="sparkle">Reprocessar agora</RAIButton>
            <RAIButton variant="secondary" icon="user">Encaminhar revisão manual</RAIButton>
            <RAIButton variant="ghost" icon="paperclip">Copiar log</RAIButton>
          </div>
        </div>

        {/* Sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RAICard>
            <div className="rai-eyebrow">Impacto no caso</div>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--rai-ink-700)', lineHeight: 1.55 }}>
              O caso permanece em <span className="rai-mono" style={{ background: 'var(--rai-bone-100)', padding: '1px 6px', borderRadius: 3 }}>DOCUMENTS_UNDER_REVIEW</span>.
              Nada foi transitado — o estado anterior está preservado.
            </div>
            <div style={{ marginTop: 14 }}><StatusChip status="DOCUMENTS_UNDER_REVIEW"/></div>
          </RAICard>
          <RAICard>
            <div className="rai-eyebrow">Histórico de tentativas</div>
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {[
                ['#3 · 02:14:38', 'falhou', 'Zod safeParse'],
                ['#2 · 02:14:08', 'falhou', 'timeout 30s'],
                ['#1 · 02:13:38', 'falhou', 'rate limited 429'],
              ].map(([t, st, det], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <span className="rai-mono" style={{ color: 'var(--rai-ink-500)', minWidth: 110 }}>{t}</span>
                  <RAIBadge tone="iron" dot>{st}</RAIBadge>
                  <span style={{ color: 'var(--rai-ink-500)' }}>{det}</span>
                </div>
              ))}
            </div>
          </RAICard>
        </aside>
      </div>
    </AppChrome>
  );
}

// ── 14 · Validação Zod · formulário com múltiplos erros ────
function ErrValidationZod() {
  return (
    <AppChrome persona="parceiro" activeNav="visits" tenantLabel="ReformAI · parceiros">
      <TopBar
        breadcrumb={['Casos atribuídos', '2026-A-0184', 'Concluir vistoria']}
        title="Concluir vistoria"
        subtitle="Vistoria final · #03 · 2026-A-0184"
        actions={<RAIBadge tone="iron" dot>3 campos inválidos</RAIBadge>}
      />
      <div style={{ padding: 32, overflow: 'auto', flex: 1 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Top error summary */}
          <div style={{ padding: '14px 18px', background: 'var(--rai-iron-100)', borderRadius: 'var(--rai-r-md)', borderLeft: '3px solid var(--rai-iron-500)', marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="rai-mono" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 2, background: 'var(--rai-iron-600)', color: '#fff', letterSpacing: '.14em' }}>VALIDATION · 400</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--rai-iron-700)' }}>Não consegui enviar o formulário · 3 problemas encontrados</span>
            </div>
            <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
              {[
                ['inspectionDate', 'Data não pode ser no passado.'],
                ['photoCount',     'Mínimo de 6 fotos · você enviou 4.'],
                ['notes',          'Conclusão técnica é obrigatória.'],
              ].map(([f, m]) => (
                <a key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--rai-iron-700)' }}>
                  <Icon name="arrow" size={11}/>
                  <span className="rai-mono" style={{ background: 'rgba(180,63,58,.18)', padding: '1px 6px', borderRadius: 3 }}>{f}</span>
                  <span>{m}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Form */}
          <div style={{ background: '#fff', borderRadius: 'var(--rai-r-md)', boxShadow: '0 0 0 1px var(--rai-border)', padding: 24 }}>
            <div style={{ display: 'grid', gap: 18 }}>
              <RAIInput label="Profissional responsável" value="Eng. Ana Pires · CREA-SP 123.456" readOnly icon="user"/>

              {/* Date with error */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--rai-ink-700)' }}>Data da vistoria</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', background: 'var(--rai-iron-100)', border: '1px solid var(--rai-iron-500)', borderRadius: 'var(--rai-r-sm)' }}>
                  <Icon name="clock" color="var(--rai-iron-600)"/>
                  <input defaultValue="15/04/2026" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--rai-font-mono)', fontSize: 14, color: 'var(--rai-iron-700)' }}/>
                  <Icon name="alert" size={14} color="var(--rai-iron-600)"/>
                </div>
                <div style={{ fontSize: 12, color: 'var(--rai-iron-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="rai-mono" style={{ background: 'var(--rai-iron-100)', padding: '1px 6px', borderRadius: 3 }}>z.date().min(today)</span>
                  Data não pode ser no passado.
                </div>
              </div>

              {/* Photo count with error */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--rai-ink-700)' }}>Fotos da vistoria · mínimo 6</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ aspectRatio: '1 / 1', background: 'var(--rai-bone-200)', borderRadius: 'var(--rai-r-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="eye" size={14} color="var(--rai-ink-400)"/>
                    </div>
                  ))}
                  {[5,6].map(i => (
                    <div key={i} style={{ aspectRatio: '1 / 1', background: 'var(--rai-iron-100)', border: '1.5px dashed var(--rai-iron-300)', borderRadius: 'var(--rai-r-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rai-iron-600)' }}>
                      <Icon name="plus" size={14} color="var(--rai-iron-600)"/>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--rai-iron-600)' }}>Faltam 2 fotos · adicione antes de concluir.</div>
              </div>

              {/* Notes with error */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--rai-ink-700)' }}>Conclusão técnica · obrigatória</label>
                <textarea placeholder="Descreva os achados e a conformidade observada..." style={{ minHeight: 90, padding: 12, fontFamily: 'inherit', fontSize: 14, color: 'var(--rai-ink-900)', background: 'var(--rai-iron-100)', border: '1px solid var(--rai-iron-500)', borderRadius: 'var(--rai-r-sm)', outline: 'none', resize: 'none' }}/>
                <div style={{ fontSize: 12, color: 'var(--rai-iron-600)' }}>Sem conclusão técnica não é possível encerrar vistorias críticas.</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid var(--rai-divider)' }}>
                <span className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-ink-400)' }}>Validação: ZodSchema · CompleteInspectionInput</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <RAIButton variant="ghost">Salvar rascunho</RAIButton>
                  <RAIButton variant="primary" disabled>Concluir vistoria</RAIButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppChrome>
  );
}

// ── 15 · Link de documento expirado (signed URL · 1h) ──────
function ErrSignedURLExpired() {
  return (
    <AppChrome persona="morador" activeNav="docs" tenantLabel="Ed. Jardim Higienópolis">
      <TopBar
        breadcrumb={['Minhas reformas', '2026-A-0184', 'Documentos', 'Memorial.pdf']}
        title="Memorial.pdf"
        subtitle="Versão 2 · enviado por Maria Oliveira em 23/05"
        actions={<RAIBadge tone="ochre" dot>Link expirado</RAIBadge>}
      />
      <div style={{ padding: 32, overflow: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        {/* Preview area */}
        <div style={{ background: '#fff', borderRadius: 'var(--rai-r-md)', boxShadow: '0 0 0 1px var(--rai-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rai-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="rai-mono" style={{ fontSize: 12, color: 'var(--rai-ink-700)' }}>Memorial.pdf · 4 páginas · 2.1 MB</span>
            <RAIButton variant="ghost" size="sm" icon="search">Buscar</RAIButton>
          </div>

          {/* Empty preview with overlay */}
          <div style={{ flex: 1, background: 'var(--rai-bone-100)', position: 'relative', minHeight: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg style={{ position: 'absolute', inset: 0, opacity: .12 }} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 600 400" fill="none">
              <defs>
                <pattern id="diag" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="14" stroke="var(--rai-ochre-600)" strokeWidth="3"/>
                </pattern>
              </defs>
              <rect width="600" height="400" fill="url(#diag)"/>
            </svg>
            <div style={{ background: '#fff', boxShadow: 'var(--rai-shadow-3)', padding: 28, borderRadius: 'var(--rai-r-md)', maxWidth: 440, textAlign: 'left', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span className="rai-mono" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 2, background: 'var(--rai-ochre-100)', color: 'var(--rai-ochre-700)', letterSpacing: '.14em' }}>SIGNED_URL · EXPIRED</span>
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: 'var(--rai-fs-lg)', fontWeight: 600, letterSpacing: 'var(--rai-tracking-snug)' }}>
                O link deste documento expirou.
              </h2>
              <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--rai-ink-500)', lineHeight: 1.55 }}>
                Por segurança, todo link de documento dura no máximo <b>1 hora</b>. O arquivo
                continua íntegro no nosso storage — peça um novo link com um clique.
              </p>
              <div style={{ padding: '10px 12px', background: 'var(--rai-bone-100)', borderRadius: 'var(--rai-r-xs)', marginBottom: 16 }}>
                <div className="rai-mono" style={{ fontSize: 11, color: 'var(--rai-ink-500)', lineHeight: 1.6 }}>
                  expired_at · 2026-05-25T15:08:32Z<br/>
                  storage_key · tenants/demo/.../incoming/doc_8f3c.pdf
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <RAIButton variant="primary" icon="paperclip">Gerar novo link</RAIButton>
                <RAIButton variant="ghost">Voltar aos documentos</RAIButton>
              </div>
            </div>
          </div>
        </div>

        {/* Side */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RAICard>
            <div className="rai-eyebrow">Política de segurança</div>
            <p style={{ marginTop: 10, fontSize: 12.5, color: 'var(--rai-ink-700)', lineHeight: 1.6 }}>
              Documentos nunca têm URL pública permanente. Cada acesso gera uma URL assinada
              que expira em 1 hora — registramos quem e quando solicitou.
            </p>
            <div className="rai-mono" style={{ marginTop: 12, fontSize: 10, color: 'var(--rai-ink-400)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              CLAUDE.md · §11 · §13 · regra #8
            </div>
          </RAICard>
          <RAICard>
            <div className="rai-eyebrow">Últimas aberturas</div>
            <div style={{ marginTop: 12, display: 'grid', gap: 8, fontSize: 12 }}>
              {[
                ['Você',          '25/05 14:02', 'AuditLog'],
                ['João Souza',    '23/05 16:48', 'sindico'],
                ['Eng. Ana Pires','23/05 09:11', 'parceiro'],
              ].map(([who, when, src], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: i > 0 ? '1px solid var(--rai-divider)' : 'none' }}>
                  <span style={{ color: 'var(--rai-ink-700)' }}>{who}</span>
                  <span className="rai-mono" style={{ color: 'var(--rai-ink-500)' }}>{when}</span>
                </div>
              ))}
            </div>
          </RAICard>
        </aside>
      </div>
    </AppChrome>
  );
}

Object.assign(window, {
  Err403Role, Err404Case,
  ErrInvalidTransition, ErrBusinessRule,
  ErrLLMUnavailable,
  ErrUploadFailed, ErrDocAnalysisFailed,
  ErrValidationZod, ErrSignedURLExpired,
});
