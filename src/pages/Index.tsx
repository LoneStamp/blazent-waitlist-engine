import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, CircleDot, Clock3, Menu, ShieldCheck, Sprout, Users, X } from 'lucide-react';
import { getFoundingLeaderForFeedback, insertFoundingLeaderApplication, isSupabaseConfigured, submitFoundingLeaderFeedback, type FeedbackApplication } from '@/lib/supabase';

type FormState = {
  full_name: string; email: string; platform: 'Android' | 'iOS' | ''; discipleship_system: string;
  disciple_count: string; church_ministry: string; city_country: string; leadership_role: string;
  threads_username: string; has_three_disciples: boolean; commits_14_days: boolean; agrees_feedback: boolean; privacy_consent: boolean;
};
const initial: FormState = { full_name:'', email:'', platform:'', discipleship_system:'', disciple_count:'', church_ministry:'', city_country:'', leadership_role:'', threads_username:'', has_three_disciples:false, commits_14_days:false, agrees_feedback:false, privacy_consent:false };
const DRAFT_KEY = 'vineward_founder_application_draft_v1';
const FEEDBACK_TOKEN_KEY = 'vineward_founder_feedback_token_v1';
function restoreDraft(): FormState {
  try {
    const saved = sessionStorage.getItem(DRAFT_KEY);
    return saved ? { ...initial, ...JSON.parse(saved) } : initial;
  } catch { return initial; }
}
function restoreFeedbackToken(): string {
  try { return new URLSearchParams(window.location.search).get('feedback') || localStorage.getItem(FEEDBACK_TOKEN_KEY) || ''; }
  catch { return new URLSearchParams(window.location.search).get('feedback') || ''; }
}
const fadeUp = { hidden:{opacity:0,y:22}, show:{opacity:1,y:0,transition:{duration:.65,ease:[.22,1,.36,1]}} };

function Field({label,required,children,hint}:{label:string;required?:boolean;children:ReactNode;hint?:string}) { return <label className="field"><span className="field-label">{label}{required && <i>*</i>}</span>{children}{hint && <small>{hint}</small>}</label>; }
function SectionLabel({number,children}:{number:string;children:ReactNode}) { return <div className="section-label"><span>{number}</span>{children}</div>; }

export default function Index() {
  const [form,setForm] = useState<FormState>(restoreDraft);
  const [status,setStatus] = useState<'idle'|'sending'|'success'|'error'>(()=>new URLSearchParams(window.location.search).has('feedback')?'success':'idle');
  const [error,setError] = useState('');
  const [feedbackToken,setFeedbackToken] = useState(restoreFeedbackToken);
  const [feedbackVerified,setFeedbackVerified] = useState<FeedbackApplication|null>(null);
  const [feedbackLookupError,setFeedbackLookupError] = useState('');
  const [feedbackLookupStatus,setFeedbackLookupStatus] = useState<'idle'|'checking'|'verified'|'error'>('idle');
  const [feedbackEmail,setFeedbackEmail] = useState('');
  const [feedbackText,setFeedbackText] = useState('');
  const [feedbackDays,setFeedbackDays] = useState('14');
  const [feedbackDisciples,setFeedbackDisciples] = useState('3');
  const [feedbackStatus,setFeedbackStatus] = useState<'idle'|'sending'|'success'|'error'>('idle');
  const [feedbackError,setFeedbackError] = useState('');
  const [mobileOpen,setMobileOpen] = useState(false);
  const [menuScrolled,setMenuScrolled] = useState(false);
  useEffect(()=>{ const onScroll=()=>setMenuScrolled(window.scrollY>12); window.addEventListener('scroll',onScroll,{passive:true}); onScroll(); return ()=>window.removeEventListener('scroll',onScroll); },[]);
  useEffect(()=>{ try { if(status==='idle') sessionStorage.setItem(DRAFT_KEY,JSON.stringify(form)); } catch { /* session draft storage is optional */ } },[form,status]);
  const source = useMemo(()=>({ source: new URLSearchParams(window.location.search).get('utm_source') || 'direct', medium: new URLSearchParams(window.location.search).get('utm_medium'), campaign: new URLSearchParams(window.location.search).get('utm_campaign'), referrer: document.referrer || null }),[]);
  const update = <K extends keyof FormState>(key:K,value:FormState[K]) => setForm(prev=>({...prev,[key]:value}));
  const ready = form.full_name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && form.platform && form.discipleship_system && form.disciple_count && form.has_three_disciples && form.commits_14_days && form.agrees_feedback && form.privacy_consent;
  const submit = async (e:FormEvent) => {
    e.preventDefault(); setError('');
    if (!ready) { setError('Please complete all required fields and confirmations.'); return; }
    if (!isSupabaseConfigured) { setStatus('error'); setError('Registration is temporarily unavailable. Please try again later.'); return; }
    setStatus('sending');
    const payload = { ...form, email:form.email.trim().toLowerCase(), full_name:form.full_name.trim(), church_ministry:form.church_ministry.trim()||null, city_country:form.city_country.trim()||null, leadership_role:form.leadership_role.trim()||null, threads_username:form.threads_username.trim().replace(/^@/, '')||null, acquisition_source:source.source, acquisition_medium:source.medium, acquisition_campaign:source.campaign, referrer:source.referrer, feedback_token:crypto.randomUUID(), status:'applicant', offer_terms_version:'founding-2026-v1' };
    const result = await insertFoundingLeaderApplication(payload);
    if (result.error) { setStatus('error'); setError((result.error as Error & {code?:string}).code === '23505' ? 'This email has already been registered. If you need to update your application, contact the Vineward team.' : 'We could not submit your application. Please check your connection and try again.'); return; }
    setFeedbackToken(result.feedbackToken || '');
    setFeedbackEmail(form.email.trim().toLowerCase());
    if (result.feedbackToken) { try { localStorage.setItem(FEEDBACK_TOKEN_KEY,result.feedbackToken); } catch { /* optional convenience */ } }
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* optional convenience */ }
    if (result.feedbackToken) window.history.replaceState({}, '', `${window.location.pathname}?feedback=${encodeURIComponent(result.feedbackToken)}#apply`);
    setStatus('success'); setForm(initial);
  };
  const verifyFeedbackEmail = async () => {
    setFeedbackLookupError('');
    setFeedbackLookupStatus('checking');
    if (!feedbackToken || !feedbackEmail.trim()) {
      setFeedbackLookupStatus('error');
      setFeedbackLookupError('Open your private feedback link and enter the email address used for your application.');
      return;
    }
    const result = await getFoundingLeaderForFeedback({ feedbackToken, email: feedbackEmail });
    if (result.error || !result.application) {
      setFeedbackLookupStatus('error');
      setFeedbackLookupError(result.error?.message || 'We could not verify this application.');
      return;
    }
    setFeedbackVerified(result.application);
    setFeedbackLookupStatus('verified');
  };
  const closeMenu = () => setMobileOpen(false);
  return <div className="site-shell">
    <header className={`site-header ${menuScrolled?'scrolled':''}`}>
      <a href="#top" className="brand" aria-label="Vineward home"><span className="brand-mark"><img src="https://vineward.vercel.app/assets/vineward-icon.png"/></span><span>vineward<span className="brand-period">.</span></span></a>
      <nav className={mobileOpen?'nav-open':''}>
        <a href="#vision" onClick={closeMenu}>The vision</a><a href="#program" onClick={closeMenu}>The program</a><a href="#fit" onClick={closeMenu}>Who can apply</a><a href="#founding-offer" onClick={closeMenu}>Founding offer</a>
        <a className="nav-cta" href="#apply" onClick={closeMenu}>Apply as a founding leader <ArrowUpRight size={15}/></a>
      </nav>
      <button className="mobile-menu" onClick={()=>setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">{mobileOpen?<X/>:<Menu/>}</button>
    </header>

    <main id="top">
      <section className="hero section-wrap">
        <div className="hero-copy">
          <motion.div className="eyebrow" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.1}}><span className="live-dot"/> AN INVITATION TO DISCIPLESHIP LEADERS</motion.div>
          <motion.h1 initial="hidden" animate="show" variants={fadeUp}>Build a rhythm.<br/><em>Multiply</em> the impact.</motion.h1>
          <motion.p className="hero-lede" initial="hidden" animate="show" variants={fadeUp} transition={{delay:.12}}>We're inviting a small group of G12 and discipleship leaders to help shape Vineward—by putting it to work with the people they lead.</motion.p>
          <motion.div className="hero-actions" initial="hidden" animate="show" variants={fadeUp} transition={{delay:.22}}><a className="button button-primary" href="#apply">Apply to become a founding leader <ArrowUpRight size={17}/></a><a className="text-link" href="#vision">Discover the vision <ArrowDownRight size={16}/></a></motion.div>
          <motion.div className="hero-proof" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.55}}><div className="avatar-stack"><span>G</span><span>12</span><span>+</span></div><p>For leaders who believe discipleship<br/>should be lived, not just discussed.</p></motion.div>
        </div>
        <motion.div className="hero-art" initial={{opacity:0,scale:.94,y:18}} animate={{opacity:1,scale:1,y:0}} transition={{duration:.9,delay:.15,ease:[.22,1,.36,1]}}>
          <div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-glow"/>
          <div className="growth-card"><div className="growth-top"><span className="tiny-mark"><Sprout size={16}/></span><span>YOUR DISCIPLESHIP RHYTHM</span><span className="growth-menu">···</span></div><div className="growth-title">Small steps.<br/><strong>Lasting growth.</strong></div><div className="growth-progress"><div className="progress-label"><span>Weekly consistency</span><b>78%</b></div><div className="progress-track"><span/></div></div><div className="week-grid">{['M','T','W','T','F','S','S'].map((d,i)=><div className={`week-day ${[0,1,2,4,5].includes(i)?'done':''}`} key={i}><span>{d}</span><i>{[0,1,2,4,5].includes(i)?<Check size={13}/>:<CircleDot size={12}/>}</i></div>)}</div><div className="growth-foot"><span><span className="status-dot"/> A rhythm worth keeping</span><ArrowUpRight size={16}/></div></div>
          <div className="floating-note note-left"><span className="note-icon"><Users size={17}/></span><div><b>One leader</b><small>Equipping a few to reach many</small></div></div>
          <div className="floating-note note-right"><span className="note-icon note-icon-light"><CheckCircle2 size={17}/></span><div><b>Progress you can see</b><small>Built around real follow-through</small></div></div>
          <div className="art-caption">A more intentional way to grow together <span>↗</span></div>
        </motion.div>
        <div className="hero-bottomline"><span>01 / THE FOUNDING LEADERS PROGRAM</span><span>GROW WITH INTENTION <i>✳</i></span></div>
      </section>

      <section className="manifesto section-wrap" id="vision">
        <SectionLabel number="01">THE IDEA</SectionLabel>
        <div className="manifesto-grid"><h2>Discipleship deserves<br/>more than <em>good intentions.</em></h2><div className="manifesto-copy"><p>Discipleship happens in the everyday: the conversations, the commitments, the tasks followed through, and the people who keep showing up.</p><p>Vineward is being built to help leaders and disciples bring more intention, structure, and visibility to that journey—one meaningful action at a time.</p><span className="manifesto-signature">A tool for the work that matters. <Sprout size={17}/></span></div></div>
        <div className="principle-strip"><div><span>01</span><b>Make it intentional</b><small>Turn good intentions into daily practice.</small></div><div><span>02</span><b>Make progress visible</b><small>Log tasks and mark meaningful follow-through.</small></div><div><span>03</span><b>Grow together</b><small>Give leaders and disciples a shared rhythm.</small></div></div>
      </section>

      <section className="program-section" id="program"><div className="section-wrap program-inner"><SectionLabel number="02">THE INVITATION</SectionLabel><div className="program-heading"><h2>Not another download.<br/><em>A real-world test.</em></h2><p>We're not looking for people to install Vineward and forget it. We're looking for leaders ready to use it with their disciples and tell us what the experience is really like.</p></div>
        <div className="program-stats"><div><b>14<span>+</span></b><small>Days of active testing</small></div><div><b>3<span>+</span></b><small>Disciples to invite</small></div><div><b>1</b><small>Shared growth journey</small></div><div className="stats-aside">A focused group of leaders.<br/>Honest use. Useful feedback.</div></div>
        <div className="steps-grid">{[{n:'01',t:'Apply',d:'Tell us about your leadership, your ministry, and the people you currently disciple.'},{n:'02',t:'Get the invitation',d:'When the testing round is ready, selected leaders will receive an email with next steps.'},{n:'03',t:'Bring your people',d:'Download Vineward and invite at least three disciples or apprentices to join you.'},{n:'04',t:'Put it into practice',d:'Use Vineward with your group for 14 days or more. Log tasks, mark progress, and build a rhythm.'},{n:'05',t:'Tell us what you learn',d:'Share honest feedback about what works, what feels difficult, and what should improve.'}].map((s,i)=><motion.div className="step-card" key={s.n} initial="hidden" whileInView="show" viewport={{once:true,amount:.2}} variants={fadeUp} transition={{delay:i*.06}}><span>{s.n}</span><h3>{s.t}</h3><p>{s.d}</p><ArrowUpRight size={17}/></motion.div>)}</div>
      </div></section>

      <section className="offer-section section-wrap" id="founding-offer">
        <div className="offer-topline"><span>THE FOUNDING LEADER BENEFIT</span><span>FOUNDING TERMS / 01</span></div>
        <div className="offer-layout">
          <div className="offer-intro"><span className="offer-kicker"><Sprout size={15}/> A THANK-YOU FOR BUILDING WITH US</span><h2>Early access now.<br/><em>A year of premium, on us.</em></h2><p>We believe the leaders who help us shape Vineward should share in what it becomes. That's why selected founding testers who complete the program will receive a meaningful early-member benefit.</p></div>
          <div className="offer-card">
            <div className="offer-card-head"><span>YOUR FOUNDING TESTER BENEFITS</span><span className="offer-seal"><Check size={17}/></span></div>
            <div className="offer-main-benefit"><b>12 MONTHS</b><strong>Premium access free</strong><p>One full year of the premium features available when Vineward's public paid plans launch.</p></div>
            <div className="offer-perks"><div><CheckCircle2/><p><b>Founding Tester recognition</b><span>A digital founding tester badge and recognition, with your permission.</span></p></div><div><CheckCircle2/><p><b>First look at new features</b><span>Priority invitations to try selected upcoming features and share feedback.</span></p></div><div><CheckCircle2/><p><b>A voice in what comes next</b><span>Opportunities to suggest and vote on product improvements.</span></p></div></div>
            <small className="offer-terms">The 12-month period begins when eligible premium plans become publicly available, not when you register. Benefits are for selected testers who complete at least 14 days of genuine use with a minimum of 3 participating disciples and submit the requested feedback. Future features, permanent free access, and lifetime pricing are not guaranteed. Any paid plan or post-benefit offer will be communicated clearly before the free period ends.</small>
          </div>
        </div>
        <div className="offer-footnote"><ShieldCheck size={16}/><span>No payment is required to apply or participate in the testing program. Selection and benefit eligibility are confirmed by Vineward.</span></div>
      </section>

      <section className="fit-section section-wrap" id="fit"><SectionLabel number="03">WHO SHOULD APPLY</SectionLabel><div className="fit-grid"><div><h2>Lead people?<br/><em>Let's grow this</em><br/>together.</h2><p className="fit-intro">The Founding Leaders Program is designed for people already investing in the growth of others.</p><div className="fit-callout"><span className="callout-icon"><Users size={19}/></span><p><b>Leading 12–15 or more?</b><br/>We'd especially love to hear from you. Larger discipleship groups are welcome.</p></div></div><div className="fit-list"><div><CheckCircle2/><p><b>G12 and G12-adapting leaders</b><span>You're currently implementing or adapting the G12 discipleship system.</span></p></div><div><CheckCircle2/><p><b>At least three active disciples</b><span>You have three or more disciples, apprentices, or people you personally lead.</span></p></div><div><CheckCircle2/><p><b>Ready to lead by example</b><span>You're willing to use Vineward yourself and introduce it to your group.</span></p></div><div><CheckCircle2/><p><b>Committed to 14+ days</b><span>You can make room for consistent use and honest feedback during the test.</span></p></div></div></div></section>

      <section className="application-section" id="apply"><div className="section-wrap application-grid"><div className="application-aside"><SectionLabel number="04">YOUR NEXT STEP</SectionLabel><h2>Help us build<br/>what comes <em>next.</em></h2><p>Share a little about yourself and the group you lead. We'll review your application and email you when the testing round is ready.</p><div className="aside-detail"><ShieldCheck size={18}/><span>Your information is used only to review and coordinate your Vineward testing application.</span></div><div className="aside-foot"><span>VINEWARD / FOUNDING LEADERS</span><Sprout size={19}/></div></div>
        <div className="form-panel"><div className="form-heading"><div><span className="form-kicker">APPLICATION FORM</span><h3>Let's get to know you.</h3></div><span className="required-note"><i>*</i> Required fields</span></div>
          {status==='success' ? <div className="success-state"><div className="success-icon"><CheckCircle2 size={30}/></div><span className="form-kicker">{new URLSearchParams(window.location.search).has('feedback') ? 'FEEDBACK PORTAL' : 'APPLICATION RECEIVED'}</span><h3>{new URLSearchParams(window.location.search).has('feedback') ? 'Let’s find your application.' : 'Thank you for stepping forward.'}</h3><p>{new URLSearchParams(window.location.search).has('feedback') ? 'Enter the email address you used when applying. We’ll match it with the private feedback link and retrieve your saved application details.' : 'Your application has been submitted. If selected, you will receive the testing instructions by email. Your 12-month premium benefit is earned only after the selected testing program is completed and Vineward verifies the requirements.'}</p>
            <div className="commitment-box"><div className="commitment-title"><ShieldCheck size={17}/><b>How reward qualification works</b></div><p>Vineward's team will verify at least 14 days of actual use, at least 3 participating disciples, and your submitted feedback. Only then will your application become reward-eligible. Final reward activation is approved by the Vineward team.</p></div>
            {feedbackToken && <div className="feedback-form">
              <h3>{feedbackVerified ? 'Your application is found.' : 'Already tested? Ready to give feedback?'}</h3>
              <p>{feedbackVerified ? 'Please review the details below before submitting your testing experience.' : 'Enter the same email address you used when applying. Your application details will appear only after the email matches this private feedback link.'}</p>
              {!feedbackVerified ? <>
                <Field label="Application email address" required><input type="email" value={feedbackEmail} onChange={e=>{setFeedbackEmail(e.target.value);setFeedbackLookupStatus('idle');setFeedbackLookupError('');}} autoComplete="email" placeholder="you@example.com" required/></Field>
                {feedbackLookupError && <div className="form-error" role="alert">{feedbackLookupError}</div>}
                <button className="button button-primary submit-button" type="button" onClick={verifyFeedbackEmail} disabled={feedbackLookupStatus==='checking'||!feedbackEmail.trim()}>{feedbackLookupStatus==='checking'?'Checking application…':'Confirm email and retrieve application'} <ArrowUpRight size={17}/></button>
              </> : <>
                <div className="application-retrieval">
                  <div><span>Applicant</span><strong>{feedbackVerified.full_name}</strong></div>
                  <div><span>Application email</span><strong>{feedbackVerified.email}</strong></div>
                  <div><span>Device</span><strong>{feedbackVerified.platform}</strong></div>
                  <div><span>Discipleship system</span><strong>{feedbackVerified.discipleship_system}</strong></div>
                  <div><span>Group size at application</span><strong>{feedbackVerified.disciple_count}</strong></div>
                  <div><span>Church / ministry</span><strong>{feedbackVerified.church_ministry || 'Not provided'}</strong></div>
                  <div><span>Leadership role</span><strong>{feedbackVerified.leadership_role || 'Not provided'}</strong></div>
                  <div><span>City / country</span><strong>{feedbackVerified.city_country || 'Not provided'}</strong></div>
                  <div><span>Application submitted</span><strong>{new Date(feedbackVerified.created_at).toLocaleDateString()}</strong></div>
                  <div><span>Application status</span><strong>{feedbackVerified.status}</strong></div>
                </div>
                {feedbackVerified.feedback_submitted_at ? <p className="form-success-note"><CheckCircle2 size={17}/> Feedback was already submitted on {new Date(feedbackVerified.feedback_submitted_at).toLocaleString()}.</p> : feedbackStatus==='success' ? <p className="form-success-note"><CheckCircle2 size={17}/> Feedback received. The Vineward team will review it alongside verified usage and group participation.</p> : <>
                  <div className="form-row"><Field label="Testing days (self-reported)" required><input type="number" min="0" max="365" value={feedbackDays} onChange={e=>setFeedbackDays(e.target.value)} required/></Field><Field label="Disciples who participated (self-reported)" required><input type="number" min="0" max="500" value={feedbackDisciples} onChange={e=>setFeedbackDisciples(e.target.value)} required/></Field></div>
                  <Field label="What worked, what was difficult, and what should we improve?" required><textarea value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} minLength={20} maxLength={10000} rows={5} placeholder="Share your honest experience (at least 20 characters)..." required/></Field>
                  {feedbackError && <div className="form-error" role="alert">{feedbackError}</div>}
                  <button className="button button-primary submit-button" type="button" disabled={feedbackStatus==='sending'||feedbackText.trim().length<20} onClick={async()=>{setFeedbackError('');setFeedbackStatus('sending');const result=await submitFoundingLeaderFeedback({feedbackToken,email:feedbackEmail,feedback:feedbackText,selfReportedDiscipleCount:Number(feedbackDisciples),selfReportedTestingDays:Number(feedbackDays)});if(result.error){setFeedbackStatus('error');setFeedbackError(result.error.message);}else{setFeedbackStatus('success');setFeedbackVerified({...feedbackVerified,feedback_submitted_at:new Date().toISOString()});}}}>{feedbackStatus==='sending'?'Submitting feedback…':'Submit testing feedback'} <ArrowUpRight size={17}/></button>
                </>}
              </>}
            </div>}
            <button className="button button-outline" onClick={()=>setStatus('idle')}>Submit another application <ArrowUpRight size={16}/></button></div> : <><button type="button" className="feedback-return-link" onClick={()=>{if(feedbackToken){setFeedbackLookupError('');window.history.replaceState({},'',`${window.location.pathname}?feedback=${encodeURIComponent(feedbackToken)}#apply`);setStatus('success');}else{setError('To protect your application, open the private feedback link from your application confirmation email or the same browser where you applied.');}}}>Already tested? <strong>I’m ready to give feedback <ArrowUpRight size={15}/></strong></button><form onSubmit={submit}>
            <div className="form-row"><Field label="Full name" required><input value={form.full_name} onChange={e=>update('full_name',e.target.value)} placeholder="Your full name" autoComplete="name" required/></Field><Field label="Email address" required hint="Use the email connected to your Google Play or Apple account."><input type="email" value={form.email} onChange={e=>update('email',e.target.value)} placeholder="you@example.com" autoComplete="email" required/></Field></div>
            <Field label="Which device will you use?" required><div className="choice-row"><button type="button" className={`choice ${form.platform==='Android'?'selected':''}`} onClick={()=>update('platform','Android')}><span className="choice-radio"/><span><b>Android</b><small>Google Play</small></span></button><button type="button" className={`choice ${form.platform==='iOS'?'selected':''}`} onClick={()=>update('platform','iOS')}><span className="choice-radio"/><span><b>iPhone</b><small>Apple App Store</small></span></button></div></Field>
            <Field label="Which discipleship system best describes your ministry?" required><div className="select-wrap"><select value={form.discipleship_system} onChange={e=>update('discipleship_system',e.target.value)} required><option value="">Select your discipleship system</option><option value="G12 Vision">Currently implementing the G12 Vision</option><option value="Adapting G12">Adapting the G12 discipleship system</option></select><ChevronDown size={17}/></div></Field>
            <Field label="How many active disciples or apprentices do you currently lead?" required><div className="select-wrap"><select value={form.disciple_count} onChange={e=>update('disciple_count',e.target.value)} required><option value="">Choose group size</option>{['3–5','6–11','12–15','16–20','More than 20'].map(v=><option key={v} value={v}>{v}</option>)}</select><ChevronDown size={17}/></div></Field>
            <div className="form-row"><Field label="Church / ministry name"><input value={form.church_ministry} onChange={e=>update('church_ministry',e.target.value)} placeholder="Your church or ministry"/></Field><Field label="Leadership role"><input value={form.leadership_role} onChange={e=>update('leadership_role',e.target.value)} placeholder="e.g. Pastor, Cell Leader"/></Field></div>
            <div className="form-row"><Field label="City / country"><input value={form.city_country} onChange={e=>update('city_country',e.target.value)} placeholder="e.g. Cebu, Philippines"/></Field><Field label="Threads username"><input value={form.threads_username} onChange={e=>update('threads_username',e.target.value)} placeholder="@yourusername"/></Field></div>
            <div className="commitment-box"><div className="commitment-title"><Clock3 size={17}/><b>Before you apply, confirm your commitment.</b></div><label className="check-line"><input type="checkbox" checked={form.has_three_disciples} onChange={e=>update('has_three_disciples',e.target.checked)}/><span>I have at least 3 disciples, apprentices, or individuals I can invite to participate.</span></label><label className="check-line"><input type="checkbox" checked={form.commits_14_days} onChange={e=>update('commits_14_days',e.target.checked)}/><span>I'm willing to use Vineward with my group for at least 14 days.</span></label><label className="check-line"><input type="checkbox" checked={form.agrees_feedback} onChange={e=>update('agrees_feedback',e.target.checked)}/><span>I'm willing to share honest feedback based on our actual experience.</span></label></div>
            <label className="check-line privacy-line"><input type="checkbox" checked={form.privacy_consent} onChange={e=>update('privacy_consent',e.target.checked)}/><span>I agree that Vineward may use the information I provide to review my application and contact me about the Founding Leaders testing program. <a href="#privacy">Privacy details</a>.</span></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="button button-primary submit-button" type="submit" disabled={!ready||status==='sending'}>{status==='sending'?'Submitting application…':'Submit founding leader application'} <ArrowUpRight size={17}/></button>
            <p className="form-disclaimer">Your unfinished form is saved temporarily in this browser tab. It is not submitted until you click the button above.</p>
            <p className="form-disclaimer">Registration is an application, not an automatic selection. Selected leaders will be contacted by email when testing is ready.</p>
          </form></>}
        </div>
      </div></section>

      <section className="closing section-wrap"><div className="closing-mark"><Sprout size={24}/></div><p>For the ones who keep showing up.</p><h2>Grow with intention.<br/><em>Progress with purpose.</em></h2><a href="#apply" className="text-link">Become a founding leader <ArrowUpRight size={16}/></a></section>
    </main>
    <section className="privacy-note section-wrap" id="privacy"><b>Privacy, plainly.</b><p>We collect the details in this form to review your application, understand the device and discipleship group you plan to test with, and contact you about Vineward testing. We do not ask for Google Play or Apple account passwords. Your application details are not displayed publicly. You can request an update or deletion by contacting the Vineward team.</p></section>
    <footer className="site-footer section-wrap"><a href="#top" className="brand"><span className="brand-mark"><img src="https://vineward.vercel.app/assets/vineward-icon.png" /></span><span>vineward<span className="brand-period">.</span></span></a><p>Growing with intention. Progressing with purpose.</p><span>© {new Date().getFullYear()} Vineward. <a href="https://www-blackblazent-com.vercel.app/">BlackBlazent.</a> All rights reserved.</span></footer>
  </div>;
}
