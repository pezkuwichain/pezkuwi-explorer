import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Stage } from '../data/citizenship';
import { NETWORK_ID, networkLabelKey } from '../config/network';
import { formatInteger } from '../lib/format';
import { shortAddress } from '../lib/address';
import { IconRotate } from '../ui/icons';
import { PATTERNS } from './guilloche';
import { cidNumber, mrz } from './mrz';
import { qrModules } from './qr';
import type { Personal } from './personal';
import './CitizenCard.css';

export type CitizenData = { stage: Stage; roles: string[]; trust: bigint; nftId?: bigint | null };

// The Kurdistan flag: the front emblem of the card (the owner's choice), drawn from the mockup's SVG.
const SUN = 'M15.00 3.80 L14.79 6.91 L15.21 6.91ZM16.83 4.08 L15.71 6.98 L16.11 7.11ZM18.49 4.88 L16.57 7.33 L16.91 7.56ZM19.85 6.13 L17.29 7.91 L17.55 8.23ZM20.77 7.73 L17.80 8.68 L17.96 9.06ZM21.18 9.54 L18.07 9.56 L18.10 9.98ZM21.04 11.38 L18.06 10.48 L17.97 10.89ZM20.37 13.10 L17.78 11.37 L17.57 11.73ZM19.22 14.54 L17.26 12.13 L16.95 12.41ZM17.69 15.59 L16.53 12.70 L16.15 12.88ZM15.92 16.13 L15.67 13.03 L15.25 13.09ZM14.08 16.13 L14.75 13.09 L14.33 13.03ZM12.31 15.59 L13.85 12.88 L13.47 12.70ZM10.78 14.54 L13.05 12.41 L12.74 12.13ZM9.63 13.10 L12.43 11.73 L12.22 11.37ZM8.96 11.38 L12.03 10.89 L11.94 10.48ZM8.82 9.54 L11.90 9.98 L11.93 9.56ZM9.23 7.73 L12.04 9.06 L12.20 8.68ZM10.15 6.13 L12.45 8.23 L12.71 7.91ZM11.51 4.88 L13.09 7.56 L13.43 7.33ZM13.17 4.08 L13.89 7.11 L14.29 6.98Z';
const Flag = () => (
  <span className="cid-flag">
    <svg viewBox="0 0 30 20" aria-hidden="true">
      <rect width="30" height="6.67" fill="#ED2024" /><rect y="6.67" width="30" height="6.67" fill="#FFFFFF" /><rect y="13.33" width="30" height="6.67" fill="#278E43" />
      <path fill="#FEBD11" d={SUN} /><circle cx="15" cy="10" r="3.3" fill="#FEBD11" />
    </svg>
  </span>
);
const Silhouette = () => (
  <svg viewBox="0 0 60 76" aria-hidden="true"><circle cx="30" cy="24" r="14" fill="currentColor" /><path d="M2 76q0-30 28-30t28 30" fill="currentColor" /></svg>
);
const RIDGE_A = 'M0 292 L46 262 L78 276 L118 236 L150 262 L188 226 L232 268 L270 244 L318 280 L352 250 L392 270 L436 232 L478 262 L540 240';
const RIDGE_B = 'M0 300 L46 270 L78 284 L118 244 L150 270 L188 234 L232 276 L270 252 L318 288 L352 258 L392 278 L436 240 L478 270 L540 248';

// The digital citizen card. Front: who (name and photo kept on this device), role, trust, number. Back: the
// wallet address with its QR, network, status and the machine-readable zone. The card is laid out left to
// right in every language, like a printed document; its Sorani title stays right to left.
export function CitizenCard({ address, data, personal }: { address: string; data: CitizenData; personal: Personal }) {
  const { t, i18n } = useTranslation();
  const [back, setBack] = useState(false);
  const number = cidNumber(data.nftId ?? null);
  const verified = data.stage === 'approved' || data.stage === 'citizen';
  const stageText = t(`citizenship.${data.stage}`);
  const role = data.roles[0];
  const lines = mrz({ nftId: data.nftId ?? null, address, given: personal.given, surname: personal.surname });
  const qr = useMemo(() => qrModules(address), [address]);
  return (
    <div className="cid-wrap">
      <div className="cid" dir="ltr">
        <div className={`cid-inner${back ? ' turned' : ''}`}>
          <section className="cid-face cid-front" aria-label={t('citizenship.card')} aria-hidden={back} inert={back}>
            <svg className="cid-art" viewBox="0 0 540 340" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="cid-fp" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#F3F6EE" /><stop offset=".5" stopColor="#F7F1DF" /><stop offset="1" stopColor="#D6E6DA" /></linearGradient>
                <radialGradient id="cid-sun" cx=".78" cy=".42" r=".55"><stop stopColor="#F2D27A" stopOpacity=".55" /><stop offset="1" stopColor="#F2D27A" stopOpacity="0" /></radialGradient>
                <pattern id="cid-micro" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 5L5 0" stroke="#1F6B4E" strokeOpacity=".07" strokeWidth=".45" /></pattern>
                <path id="cid-ring" d="M14 14H526V326H14Z" />
                {/* Where the rosette lines crowd at their centre they would read as a solid "eye": fade them out there. */}
                <radialGradient id="cid-hole-g" gradientUnits="userSpaceOnUse" cx="420" cy="150" r="70"><stop offset=".45" stopColor="#000" /><stop offset="1" stopColor="#FFF" /></radialGradient>
                <mask id="cid-hole" maskUnits="userSpaceOnUse" x="0" y="0" width="540" height="340"><rect width="540" height="340" fill="url(#cid-hole-g)" /></mask>
              </defs>
              <rect width="540" height="340" fill="url(#cid-fp)" />
              <rect width="540" height="340" fill="url(#cid-micro)" />
              <rect width="540" height="340" fill="url(#cid-sun)" />
              <path d={RIDGE_A} fill="none" stroke="#2C6B52" strokeOpacity=".22" strokeWidth=".8" />
              <path d={RIDGE_B} fill="none" stroke="#B08A2E" strokeOpacity=".18" strokeWidth=".6" />
              <g fill="none" strokeWidth=".55" mask="url(#cid-hole)">
                <path d={PATTERNS.roseA} stroke="#2C7A5B" strokeOpacity=".28" />
                <path d={PATTERNS.roseB} stroke="#B08A2E" strokeOpacity=".30" />
                <path d={PATTERNS.roseC} stroke="#2C7A5B" strokeOpacity=".18" />
              </g>
              <g fill="none" strokeWidth=".5" stroke="#2C7A5B" strokeOpacity=".16">
                <path d={PATTERNS.waveA} /><path d={PATTERNS.waveB} /><path d={PATTERNS.waveC} />
              </g>
              <path d="M0 300 Q120 262 200 298T380 290T540 300V340H0Z" fill="#017A2F" opacity=".10" />
              <rect x="14" y="14" width="512" height="312" rx="16" fill="none" stroke="#A88A43" strokeOpacity=".55" strokeWidth=".7" />
              <text fontFamily="JetBrains Mono, monospace" fontSize="4.2" letterSpacing=".6" fill="#2C6B52" fillOpacity=".55"><textPath href="#cid-ring">{PATTERNS.micro}</textPath></text>
              <rect x="20" y="20" width="500" height="300" rx="12" fill="none" stroke="#FFFFFF" strokeOpacity=".7" strokeWidth=".7" />
            </svg>
            <img className="cid-emboss" src="/brand/newroz-flame.svg" alt="" />
            <div className="cid-holo" aria-hidden="true" />
            <div className="cid-body">
              <div className="cid-head">
                <Flag />
                <span className="cid-titles">
                  <span className="cid-title-row">
                    <strong className="cid-title">KOMARA KURDISTAN</strong>
                    <strong className="cid-title-ckb" dir="rtl" lang="ckb">کۆماری کوردستان</strong>
                  </span>
                  <small className="cid-sub">DIJITAL KURDISTAN · <bdi>{t('cid.idName').toLocaleUpperCase(i18n.language)}</bdi> · e-ID</small>
                </span>
              </div>
              <div className="cid-mid">
                <div className="cid-photo-col">
                  <span className="cid-photo">
                    {personal.photo ? <img src={personal.photo} alt={t('cid.photoAlt')} /> : <Silhouette />}
                  </span>
                  {!personal.photo && <span className="cid-photo-label">+ <bdi>{t('cid.photo')}</bdi></span>}
                </div>
                <div className="cid-fields">
                  <div><div className="cid-label"><bdi>{t('cid.given')}</bdi></div><div className="cid-value cid-line">{personal.given}</div></div>
                  <div><div className="cid-label"><bdi>{t('cid.surname')}</bdi></div><div className="cid-value cid-line">{personal.surname}</div></div>
                  <div className="cid-pair">
                    <div><div className="cid-label"><bdi>{t('cid.role')}</bdi></div><div className="cid-value">{role ? t(`tiki.${role}`, { defaultValue: role }) : '—'}</div></div>
                    <div><div className="cid-label"><bdi>{t('citizenship.trust')}</bdi></div><div className="cid-value cid-trust"><bdi>{formatInteger(data.trust, i18n.language)}</bdi></div></div>
                  </div>
                </div>
                <div className="cid-side" aria-hidden="true">
                  <span className="cid-chipcard"><svg viewBox="0 0 40 30"><g fill="none" stroke="#8A6A1E" strokeOpacity=".7" strokeWidth=".8"><path d="M0 10h13M0 20h13M27 10h13M27 20h13M13 0v30M27 0v30M13 15h14" /><rect x="13" y="8" width="14" height="14" rx="2" /></g></svg></span>
                  <span className="cid-ghost">{personal.photo ? <img src={personal.photo} alt="" /> : <Silhouette />}</span>
                </div>
              </div>
              <div className="cid-foot">
                <div className="cid-number-row">
                  <span className="cid-label"><bdi>{t('cid.number')}</bdi></span>
                  {number ? <span className="cid-number laser">{number}</span> : <bdi className="cid-number-stage">{stageText}</bdi>}
                </div>
                <div className="cid-net">
                  {verified && <span className="cid-chip">✓ <bdi>{t('citizenship.approved')}</bdi></span>}
                  {/* The testnet says so on the card; mainnet is the plain PEZKUWICHAIN. */}
                  <span>{NETWORK_ID === 'zagros' ? 'PEZKUWICHAIN · ZAGROS' : 'PEZKUWICHAIN'}</span>
                  <span className="cid-mono" title={address}>{shortAddress(address)}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="cid-face cid-back" aria-label={t('citizenship.card')} aria-hidden={!back} inert={!back}>
            <svg className="cid-art" viewBox="0 0 540 340" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="cid-bp" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#DCEADF" /><stop offset=".55" stopColor="#F6F0DF" /><stop offset="1" stopColor="#DDE6D7" /></linearGradient></defs>
              <rect width="540" height="340" fill="url(#cid-bp)" />
              <g fill="none" strokeWidth=".5">
                <path d={PATTERNS.roseD} stroke="#B08A2E" strokeOpacity=".2" />
                <path d={PATTERNS.waveA} stroke="#2C7A5B" strokeOpacity=".14" />
                <path d={PATTERNS.waveC} stroke="#2C7A5B" strokeOpacity=".14" />
              </g>
              {/* Calm paper under the address and status, so the text never sits on line work. */}
              <rect x="24" y="64" width="372" height="164" rx="10" fill="#F7F5EC" fillOpacity=".72" />
              <rect x="0" y="236" width="540" height="104" fill="#FFFFFF" fillOpacity=".72" />
              <rect x="14" y="14" width="512" height="312" rx="16" fill="none" stroke="#A88A43" strokeOpacity=".55" strokeWidth=".7" />
            </svg>
            <div className="cid-holo cid-holo-back" aria-hidden="true" />
            <div className="cid-body cid-body-back">
              <div className="cid-head">
                <strong className="cid-back-title">DIJITAL KURDISTAN <span className="cid-star">✦</span> WELATÎ</strong>
                {data.nftId != null && <span className="cid-label">ON-CHAIN · NFT {data.nftId.toString()}</span>}
              </div>
              <div className="cid-back-mid">
                <div className="cid-back-fields">
                  <div><div className="cid-label"><bdi>{t('cid.wallet')}</bdi></div><div className="cid-mono cid-address">{address}</div></div>
                  <div className="cid-pair">
                    <div><div className="cid-label"><bdi>{t('network.title')}</bdi></div><div className="cid-value"><bdi>{t(networkLabelKey(NETWORK_ID))}</bdi></div></div>
                    <div><div className="cid-label"><bdi>{t('cid.status')}</bdi></div><div className={`cid-value${verified ? ' cid-ok' : ''}`}>{stageText}</div></div>
                  </div>
                </div>
                <span className="cid-qr">
                  <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={`QR · ${t('cid.wallet')}`} shapeRendering="crispEdges"><path fill="#0F2A1F" d={qr.path} /></svg>
                </span>
              </div>
              <div className="cid-motto">HER BÎJÎ KURDISTAN</div>
              <div className="cid-mrz" aria-label="MRZ">{lines.map((l, i) => <div key={i}>{l}</div>)}</div>
            </div>
          </section>
        </div>
        {/* The whole card is this one button: it flips the card; the faces above stay readable as text. */}
        <button type="button" className="cid-flip" aria-label={t(back ? 'cid.showFront' : 'cid.showBack')} onClick={() => setBack((b) => !b)} />
      </div>
      <p className="cid-hint" aria-hidden="true"><IconRotate size={14} />{t(back ? 'cid.hintFront' : 'cid.hintBack')}</p>
    </div>
  );
}
