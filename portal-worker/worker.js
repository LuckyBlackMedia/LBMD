// ============================================================
// LBMD Client Portal — Cloudflare Worker
// Lucky Black Media & Design
// portal.myluckyblackmedia.com
// D1: lbmd-portal-db | KV: LBMD_SESSIONS
// ============================================================

import { Storage }                from '../shared/storage.js';
import { ensureBlackSuiteSchema } from '../shared/schema.js';

const ADMIN_PW_HASH = '109d554dd51d67da8e3e42bebe5035fe165c4e449f5acc9cdd8ecb47c1734f17';
const SALT = 'lbmd_salt_2026';
const REVIEW_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzcRA1TzD-t4Dj7EK6eisPuJa9xrN25N_fGxY6aBKV6QbgfAHpxoulMH7KUHSJJZJme/exec';

// ── HTML PAGES (embedded) ──
const PORTAL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LBMD Client Portal</title>
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" rel="stylesheet">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
:root{
  --black:#080808;--charcoal:#111111;--dark:#1C1C1C;--navy:#0D1B33;
  --gold:#B8962E;--gold-l:#D4AF5A;--gold-pale:#E8D49A;--gold-dark:#8C6D1F;
  --silver:#999;--mid:#555;--off-white:#F7F4EE;
  --white:#fff;--green:#27AE60;--amber:#E67E22;--red:#C0392B;
  --border:rgba(184,150,46,0.15);--surface:rgba(255,255,255,0.03);
  --font-display:'Cormorant Garamond',Georgia,serif;
  --font-body:'Satoshi','Helvetica Neue',sans-serif;
  --transition:180ms cubic-bezier(.16,1,.3,1);
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-font-smoothing:antialiased}
body{background:var(--black);color:var(--off-white);font-family:var(--font-body);font-size:14px;line-height:1.6;min-height:100vh}
a{color:var(--gold);text-decoration:none}
button{cursor:pointer;font-family:var(--font-body)}
.hidden{display:none!important}

/* ── LOGIN ── */
#login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--black);padding:20px}
.login-card{background:var(--charcoal);border:1px solid var(--border);border-radius:12px;overflow:hidden;width:100%;max-width:400px;box-shadow:0 24px 64px rgba(0,0,0,.6)}
.login-logo{background:var(--navy);padding:32px;text-align:center}
.login-logo img{width:80px;height:auto}
.login-body{padding:36px 32px}
.login-body h2{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:400;color:var(--white);margin-bottom:6px}
.login-body p{color:var(--silver);font-size:13px;letter-spacing:.03em;margin-bottom:28px}
.login-divider{width:40px;height:1px;background:var(--gold);margin-bottom:28px}
.field-label{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--silver);margin-bottom:6px;display:block}
.field-wrap{position:relative}
.login-input{width:100%;background:var(--dark);border:1px solid rgba(184,150,46,.12);border-radius:6px;padding:12px 44px 12px 14px;color:var(--off-white);font-family:var(--font-body);font-size:13px;outline:none;transition:border var(--transition)}
.login-input:focus{border-color:var(--gold)}
.pw-toggle{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--silver);font-size:16px;padding:4px}
.pw-toggle:hover{color:var(--gold)}
.login-error{color:var(--red);font-size:12px;margin-top:8px;min-height:18px}
.login-btn{width:100%;margin-top:20px;background:var(--gold);color:var(--black);border:none;border-radius:6px;padding:13px;font-family:var(--font-body);font-size:11px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;transition:background var(--transition)}
.login-btn:hover{background:var(--gold-l)}
.login-btn:disabled{opacity:.5;cursor:not-allowed}
.forgot-link{display:block;text-align:center;margin-top:14px;font-size:11px;color:var(--silver);letter-spacing:.5px;cursor:pointer;transition:color .2s}
.forgot-link:hover{color:var(--gold)}
.reset-step{display:none}
.reset-step.active{display:block}
.otp-input{width:100%;text-align:center;letter-spacing:8px;font-size:20px;font-weight:700;background:#0d0d0d;border:1px solid var(--border);border-radius:6px;padding:12px;color:var(--white);outline:none;margin-bottom:4px}
.otp-input:focus{border-color:var(--gold)}
.back-link{display:block;text-align:center;margin-top:12px;font-size:11px;color:var(--silver);cursor:pointer}
.back-link:hover{color:var(--gold)}
.login-footer{text-align:center;margin-top:20px;font-size:11px;color:#444;letter-spacing:1px}
.lockout-msg{background:rgba(192,57,43,.1);border:1px solid var(--red);border-radius:6px;padding:12px;font-size:12px;color:var(--red);text-align:center;margin-top:12px}

/* ── CLOSED STATE ── */
#closed-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.closed-card{background:var(--charcoal);border:1px solid var(--border);border-radius:12px;padding:48px 40px;max-width:460px;text-align:center}
.closed-card img{width:60px;margin-bottom:24px}
.closed-card h2{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:400;margin-bottom:12px}
.closed-card p{color:var(--silver);font-size:13px;line-height:1.7;margin-bottom:20px}
.closed-card a{color:var(--gold)}

/* ── PORTAL LAYOUT ── */
#portal{display:flex;flex-direction:column;min-height:100vh}
.portal-nav{background:rgba(8,8,8,.96);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:0 28px;display:flex;align-items:center;justify-content:space-between;height:60px;position:sticky;top:0;z-index:100}
.nav-left{display:flex;align-items:center;gap:16px}
.nav-monogram{font-family:var(--font-display);font-size:1.35rem;font-weight:700;color:var(--gold);letter-spacing:.08em;line-height:1}
.nav-monogram span{display:block;font-size:9px;font-weight:400;letter-spacing:.38em;color:var(--silver);text-transform:uppercase;font-family:var(--font-body);margin-top:2px}
.nav-divider{width:1px;height:20px;background:var(--border)}
.nav-client{font-size:12px;color:var(--silver);letter-spacing:.04em}
.nav-client strong{color:var(--off-white);font-weight:600}
.nav-right{display:flex;align-items:center;gap:12px}
.nav-date{font-size:11px;color:var(--mid);letter-spacing:.08em}
.nav-logout{background:none;border:1px solid rgba(255,255,255,.08);color:var(--silver);padding:6px 14px;border-radius:4px;font-size:11px;letter-spacing:.1em;transition:all var(--transition)}
.nav-logout:hover{border-color:var(--gold);color:var(--gold)}

/* ── TABS ── */
.tab-bar{background:var(--charcoal);border-bottom:1px solid var(--border);padding:0 28px;display:flex;gap:0}
.tab-btn{background:none;border:none;border-bottom:2px solid transparent;padding:14px 20px;font-family:var(--font-body);font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--silver);transition:all var(--transition)}
.tab-btn.active{color:var(--gold);border-bottom-color:var(--gold)}
.tab-btn:hover:not(.active){color:var(--off-white)}
.tab-content{display:none;flex:1}
.tab-content.active{display:block}

/* ── DASHBOARD ── */
.dash-wrap{max-width:920px;margin:0 auto;padding:40px 28px}
.section-eyebrow{font-size:10px;letter-spacing:.38em;text-transform:uppercase;color:var(--gold);margin-bottom:8px}
.section-heading{font-family:var(--font-display);font-size:clamp(1.6rem,3vw,2.4rem);font-weight:400;color:var(--off-white);margin-bottom:6px}
.section-sub{color:var(--silver);font-size:13px;letter-spacing:.04em;margin-bottom:32px}

/* phase badge */
.phase-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:28px}
.phase-badge.in_progress{background:rgba(230,126,34,.12);color:var(--amber);border:1px solid rgba(230,126,34,.3)}
.phase-badge.in_review{background:rgba(184,150,46,.12);color:var(--gold);border:1px solid rgba(184,150,46,.3)}
.phase-badge.complete{background:rgba(39,174,96,.12);color:var(--green);border:1px solid rgba(39,174,96,.3)}
.phase-dot{width:6px;height:6px;border-radius:50%;background:currentColor}

/* file cards — 2-col preferred */
.files-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;margin-bottom:36px}
.file-card{background:var(--charcoal);border:1px solid var(--border);border-radius:10px;padding:22px;text-decoration:none;transition:border-color var(--transition),transform var(--transition),box-shadow var(--transition);display:block;position:relative;overflow:hidden}
.file-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--gold),var(--gold-pale));transform:scaleX(0);transition:transform .35s cubic-bezier(.16,1,.3,1);transform-origin:left}
.file-card:hover{border-color:rgba(184,150,46,.4);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.45)}
.file-card:hover::before{transform:scaleX(1)}
.file-icon{font-size:22px;margin-bottom:12px}
.file-label{font-size:14px;font-weight:600;color:var(--off-white);margin-bottom:4px;letter-spacing:.02em}
.file-subtitle{font-size:10px;color:var(--gold);letter-spacing:.32em;text-transform:uppercase;margin-bottom:6px}
.file-desc{font-size:12px;color:var(--silver);line-height:1.6}
.file-arrow{position:absolute;right:16px;top:50%;transform:translateY(-50%);color:var(--gold);font-size:18px;opacity:0;transition:opacity var(--transition)}
.file-card:hover .file-arrow{opacity:1}
.file-card.locked{opacity:.5;cursor:not-allowed;pointer-events:none}
.file-card.locked::after{content:'🔒';position:absolute;top:12px;right:12px;font-size:14px}

/* admin note */
.note-block{background:#0d0d0d;border:1px solid var(--border);border-left:3px solid var(--gold);border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:32px}
.note-label{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:8px}
.note-text{font-size:13px;color:var(--silver);line-height:1.7}
.note-empty{color:#444;font-style:italic}

/* status checklist */
.status-block{background:var(--charcoal);border:1px solid var(--border);border-radius:8px;padding:20px 24px}
.status-label{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--silver);margin-bottom:14px}
.status-items{list-style:none}
.status-item{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #1a1a1a;font-size:13px;color:var(--silver)}
.status-item:last-child{border-bottom:none}
.status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.status-dot.done{background:var(--green)}
.status-dot.active{background:var(--gold)}
.status-dot.pending{background:#333}

/* ── REVIEW TAB ── */
.review-wrap{max-width:860px;margin:0 auto;padding:36px 24px}
.review-header{margin-bottom:28px}
.review-progress-bar{background:#1a1a1a;border-radius:4px;height:4px;margin-top:16px;margin-bottom:6px;overflow:hidden}
.review-progress-fill{height:100%;background:var(--gold);transition:width .4s;border-radius:4px}
.progress-label{font-size:11px;color:var(--silver)}
.progress-label span{color:var(--gold);font-weight:600}
.review-items-list{display:flex;flex-direction:column;gap:12px;margin-bottom:32px}
.review-item{background:var(--charcoal);border:1px solid var(--border);border-radius:8px;padding:18px 20px;transition:border-color .2s;overflow:hidden}
.review-thumb{margin:-18px -20px 14px -20px;width:calc(100% + 40px);height:180px;overflow:hidden;background:#0a0a0a;display:flex;align-items:center;justify-content:center}
.review-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.drive-loading{padding:20px;color:var(--silver);font-size:13px;text-align:center;letter-spacing:1px}
.review-cats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid var(--border)}
.review-cat-btn{background:none;border:1px solid #2a2a2a;color:var(--silver);padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;letter-spacing:.5px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:8px;font-family:'Montserrat',sans-serif}
.review-cat-btn:hover{border-color:var(--gold);color:var(--white)}
.review-cat-btn.active{background:rgba(184,150,46,.12);border-color:var(--gold);color:var(--gold)}
.cat-badge{font-size:10px;background:#1a1a1a;border-radius:3px;padding:2px 6px;color:#555}
.review-cat-btn.active .cat-badge{background:rgba(184,150,46,.1);color:var(--gold-l)}
.review-item.rated{border-color:#2a2a2a}
.review-item-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px}
.review-item-label{font-size:14px;font-weight:600;color:var(--white)}
.review-item-type{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--silver);background:#1a1a1a;padding:3px 8px;border-radius:3px}
.rating-btns{display:flex;gap:8px;flex-wrap:wrap}
.rating-btn{background:none;border:1px solid #2a2a2a;color:var(--silver);padding:7px 16px;border-radius:4px;font-size:12px;font-weight:600;transition:all .2s;display:flex;align-items:center;gap:5px}
.rating-btn:hover{border-color:var(--gold);color:var(--white)}
.rating-btn.active-love{background:rgba(39,174,96,.15);border-color:var(--green);color:var(--green)}
.rating-btn.active-maybe{background:rgba(184,150,46,.15);border-color:var(--gold);color:var(--gold)}
.rating-btn.active-pass{background:rgba(192,57,43,.15);border-color:var(--red);color:var(--red)}
.review-note-input{width:100%;margin-top:10px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:4px;padding:10px 12px;color:var(--silver);font-family:'Montserrat',sans-serif;font-size:12px;resize:vertical;min-height:60px;outline:none;transition:border .2s}
.review-note-input:focus{border-color:var(--gold);color:var(--white)}
.review-note-input::placeholder{color:#444}
.review-empty{text-align:center;padding:60px 20px;color:var(--silver)}
.review-empty h3{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;margin-bottom:8px;color:var(--white)}

/* submit area */
.submit-area{background:var(--charcoal);border:1px solid var(--border);border-radius:8px;padding:24px;text-align:center}
.submit-area p{color:var(--silver);font-size:12px;margin-bottom:16px}
.submit-btn{background:var(--gold);color:var(--black);border:none;border-radius:6px;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;transition:background .2s}
.submit-btn:hover:not(:disabled){background:var(--gold-l)}
.submit-btn:disabled{opacity:.5;cursor:not-allowed}
.submit-success{background:rgba(39,174,96,.1);border:1px solid var(--green);border-radius:6px;padding:16px;color:var(--green);font-size:13px;display:flex;align-items:center;gap:8px;justify-content:center}
.submit-error{background:rgba(192,57,43,.1);border:1px solid var(--red);border-radius:6px;padding:12px 16px;color:var(--red);font-size:12px;margin-top:12px;text-align:left}
.unrated-warn{font-size:11px;color:var(--amber);margin-bottom:10px}

/* ── FOOTER ── */
.portal-footer{border-top:1px solid var(--border);padding:20px 28px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.footer-links{display:flex;gap:20px}
.footer-link{font-size:11px;color:var(--mid);letter-spacing:.06em;transition:color var(--transition)}
.footer-link:hover{color:var(--silver)}
.footer-copy{font-size:11px;color:#444;letter-spacing:.06em}
.bs-powered{width:100%;text-align:center;padding-top:12px;font-size:10px;letter-spacing:.32em;color:#333;text-transform:uppercase;border-top:1px solid rgba(184,150,46,.06);font-family:var(--font-body)}

@media(max-width:600px){
  .files-grid{grid-template-columns:1fr}
  .rating-btns{flex-direction:column}
  .portal-nav{padding:0 16px}
  .dash-wrap,.review-wrap{padding:28px 16px}
  .tab-btn{padding:12px 14px;font-size:10px}
  .nav-monogram span{display:none}
}
</style>
</head>
<body>

<!-- LOGIN SCREEN -->
<div id="login-screen">
  <div class="login-card">
    <div class="login-logo">
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALIAAAC7CAYAAADBhcSgAABHhElEQVR42u29aXhc1ZUu/K69z6lBgyfAsRltpoDNFHACnrAEdCAkIQ03VaqSjYUdsO9NJzfpEJL+0vd2qW53vvvk9hS6k3SbgEryTFXDdyE0HTrpSEaDDXE6YbAhZrAJYINtPGiq4Zy91/fjnCOXZcmqKknGQ63nqceydOpM+91rv2vtNQBlKVqYQcP9LZkMSeaYAACOxUQs5vw88N1YTHAsJpzjjpwnFosJ5pg43rnLUpbRgzcWE4zCQZZMhuRornW8/5elLEUBcCjgciwmNjXVXTD4957m7WyO/qAzEY04P0eiHYlos3dMa6JhUkdT5NH25kj8peTSeEdLdK6n4btWL7n05eSyRVtWL5lZyH261ytrb1fO6Jk+FFDD4ZTyfk8AA8COh+/wdyYiDzKDOmfu+D9SyuuZQfmacvbs7eSecxYTxza31D8AxtcJfKFHF4RUk0E0z2/KbCZnd1sZvMGxmCACs1ZxpdQyCB1rT0S+n0yGpDc5tqxecu2zD9/hz59M8Xhcw72/sgDGmfzwBDAziAgci0HE49DtzdGVWw2x8AXNAqwab2x4fMfvplfb5/ZjQWdzdD4Rps9vWP9tNABAfABIodAs52fNBwXhT5nwEEj8GZgf3JYKmUAqJ6zcBAhhE1M6l9M9NSs2fETkgZEDn4quXgwAHc3RzvMy/ivD8firrz26vPojlf67cyeffReAbDIZkhSOqy1rFs8y+g/vmrPymf4yjM9gILe2LjLO2TdVEKVyra0xo7Y2brc/Fr5NgD9fVeVfnO3O6esa1vdxMiQpnFIdzVEThLfA3NaRiKYs+B6ozvn7enb/nvfNnsptbW3EDO5qxlaQemVew8Zbt65aYWb9vf86O5S0AIKUvJ9BnVlLTakMmud1JcJzkkn+z4sPTvZn0X3R5tWRuCEl5yz1kT+dfRcADpj9l0LTgeuWru3bumqFOSf8iNX+WHQBgMfS/urvA1jdGltk1MY32YNXm7bYIrlv9lQOh1PqDFBKp7d3obExRu4y7ADYHfSOpui3hEB0f7bnc3etfGa/ownrPktM39A+sUQqXsCKZ+Z27fkJagDfzulLYegX5y9Nvtr+WHRBT+/BX9/5jZ9nh+Ovi288YL7/YTfVLmvJPL3qCxXVvrN0TWW/RcOAqjURmuYX5lWmlJXUF/zFnJWP9DMzda6OhAXEnOfevvy7jQC6ZrxeKw0jwcyPKI0LFty3fmUyGZJnAljPWCAP9byxmAPszkTkJ0Riv5T4sqXUF3+x84qdjQA6Z+z4f6qrzCv7+q2PNOt/WHDf428NTIxkSP4m65uakYp8Sp7HWk/RGlVCIgCQqRQkEySzZjCxIGIttGDNGgCIBAlAEpFmDU0SisGWVsgIgf2s8SGkPGAwqY8O7esdPFGSyZA8t9/4QTAgt1oWX24r9WVDygU33buumwHKp0pbV60wVbD3v9la757XsPEJ5/qnL6c+bYCcr5W8n7sSkTsURPWCSuvJlGvIAcBzq5dUVin1ghD4V3/APNyftqYsuG/Dtwefc2vLvRdC0iUQ6hwwJmjFgomyENyvlT6kSR5ioFuoXK8yzX5pWpnstr3W4GX+GO0bW2T0nFvtm1w1wS8tq0JLX5VkNUkwTYLgiSBRAcA0hFQaultouVex+rC62r/7yj9u6vHO095Uf4+2rd9+OAl/CG2bxRSP64Fnb4k+RKC5WqNNkd53830bN5zOmvt008jUGlska1CjKR7Xm5qjn5HM31+wbOMfAUDrqujZNSs2fNS1JjybtbxrwX0b/l/vi10/DU0RFeZMg+gSaJ7IRIIIB0HYA8jdtq323XTvuu5i7oUH6T8ij74WJlvWLJ5gMk21hT5XkvwEoCdqkBDEhyyb3qkOZH97VTiVy6c0s2dvp0/00rWSxA+YsUkpfsIwkZvf8PjbQ2lljsUEZm8nCqdOaS/IKQ9kZtDmvwsF6BzjTgLNs5S+YE+linqapyMRfbIqaOzI5PQFWuvn5t23YbX33edb6i73C2O20vwJIYgFsEcQ70Sf9Yc5K1OHh7xeLCZSrqsttG0Wo9HxXJS6bA/s5DXGKP+8lMfrj1olVoUmotK8UDPNVMD5QrMm4vdtyNfmLl37FgHc2rrIMHdO+45hyJlK6ShAS+Yv2/B/R9LIHj0pA/lEex5cw60zEfm+FOKTzPr/BgJmfU+//czCZRv+KZUKiQv6xEJf0Hc1i8zqOeHU4c5E9AoW+lpiMU0IOqyhdlBAvz4vnDowGGCpVEh4YP24+CUzyAN5KJTSg++jKxmawhlxhYC8XCtMAOy9guVv5i7f8MZLaxaf36twE8P+7S92XrGzsbGRiYjzQdvRFFlNgn7jz1b/ZM7KRywXE1wG8jgPav5AciwmKB7XHYn660yDVmdz+u/9PlFl2eq/7K5Utw5w5ljIN32meatk/UmS4pBi/ep52v/qzGUtmcHL8rZtszg+jDY8WWS4e21NNARMlb2KDLqamCdqktv7BHXevnRtX/47a0ObcBRAOMIsviQkXtCMeYEK9cANoVQ3CEAyJBpPgXdxygDZWXpjROS80MFg9pbLzkR0TdAvuS9jbZNV+h/mhpKZzS31n2bmT4PI0Kxfsiv11tpwqjf/u+4yzqcwPySOORo7nza0JkNVgT4xR0NeI4gtrcXWecvXbfWow9ZVX6jIBqpfBPje+Q0bf9vZHE0w45cLlm1Yt3XVCtPVzt77Pen58ymjkX+3eklln219bV6V/pt8X2wsBjF7doim9VRNkaZF85eu3dveFPkjknS1gP6ANLrmLnt8Vz54t51CmqZUbZ0P6s2Juhks5DwNngaF16sMuem6pWv7upqjKxm4ubrS3NvTm7sWSiz793fXvxuPQ3ckIg9oiO03L1vfWdbIo+SFFI/rzrX1F0ng4r5M5u2A9P/V/GUb7o25sQbMMeFp6udWL6mssNUtQtAssH51YqXadJWrfWOxmGgEQKcpeId9j+5ze5P21WSo6lDauJmVnkUkdi5YtuGJ1tgi46yrL6zpPmRtX3D/xt0A0NFUt5CEaGHmJ4iQVUo9vHB5ar+HmJPRIDwpt6gd6hBnZtCWBPvgo7snV1VenU5bbwLAbGw3AOSI4nrLmsUTLKXuIGXPIGDrvAp7QGMnkyHpGEhxHceZJ97E9QxXd2I/y8nQc5398ubORPTPNNOOa7685klvdfviuaHqDNFfBf3yqXRWfwjWTNK8EMD+xkZQHNAnoz/6pNLI3rJ/28Vvny+JfXPfuuRtbzA2t9x7pdLW35I07pu/dO3eratWmBnz8J1Ciss109b5DevbPO6cr6nLMni1O/JumEFdiUgtiD4D4PXcjN3PVFd/krKv9DQxsIsZHwpDJucvXbvXizlpX1c/eeHi9QdPtuc6qcI4w+GUisfjmtj+U85pi+JxzczEyZCc27Dmte7uQ3fPX7p27+aW6IKMr/tPicjOvr377xfct76VCOyFVZZBfLzVzgWxGz46f/nGX+V27f4bgC3fzmkP9r18+NPzl224F0K/SgIzKJDtaY0tMiicUl0tkR9ONM0fdzZHv8EMisVOHvx87Bo5FouJRmdnSXU0R/4UtvgdSf0/TZ/8JUH/8uyc72XPTfZiU90FFtHdEOKgFPSUt9PmueHKMC2NR3vvbsuaxRO00n+swWdZnE7ULnvqUGvrImPfvql8YcZ/lVLqLhCqAO7RjIMLl238cWtskVHTWKM/buVBHzeI870Hnavr5pGWzzDzPxsm/YGYLp101kd//rveavvctPgyaTqfbPXUvAdSb5YBPH6A7vpp6FJtGHcz8Tv2RXuerK3dZHc0Rf4XQIdAkACfZUH9sOa+WXtBcaZygD/w4uolV/2i5d6ztq66wQSAzkS0sasl8sMBcCeiV3Q213+3syV6ez6XLkNv/OyUgXffEr29s7n+u+3NkdkA0JWI/sXLyaXNHYnoeo9vA0B7oq7m41aKH8vFHet4hcz6Dv+gosI3vftw5nuLVqR2ertO5sxpF+2u0LvO7zMiTDgbQm6Yv3Tt3lgMorERfDqHI54cBiGosREUj0N3rl4yFbaKCkkfzG1Y//hvk0vPSyN9YC6Qo3BKdTRF/hdJTJ/fsPGBratWmD2XT+e2Nuj46bxSMoNaY4sMAGhvin6tIxH9SwDYtGbx9PZEXcjLUXuh5d6zOhKR72xurv9cvrVdhtiJ93B4P3c0Re/sTET/bOu66NkeFelsjkQ7myPtrbFFxuBVMnaCM79P6MWIwPtmT3U9C1whCJN/8y/1F0lb/YggK+PxuO5orq9VbK2Q4OTc+9b/m5eGX/ZEfDweDna2wMWC5RueFdAb0xY/sDmxuIbica0AaFM01MY32eFwSnU013325WTD9zsS9dc5G1YnbsU/IRfyIq22rouePWfxhv3MMbGreZdvN7J/V1Xh+0R3X/aJhcsfX9/ZHF3GzIa1a0+iNr7JLqfwnFzcORxOqdbYIsM/89z7FLG1sGFji6edOy7eMY8YP5hc5f+HQ73ZuxXptTc3PP7MiRrDEzZjOBYTnTN+nxDA5nnLNv7z4L93Ntd/G8SvzG/Y8JxHQ8pc+OSjht6YdLZEb2fN17JP/HTh4vUHOxOR/84g/4f7My3TzvHfDKYr59234a8aG2MEHNkmP2WBzBwTv/nZnsCcux7pfyHRMM2mXFIpfuiDarU1HE6pTauXzJRK3cvETyy8b+O2shY+dbRze3NktoC4Wyusl4esPZhiPCYNsctS6gvw4Y750Y17UqmQOBHjKcZ7Brf9eHtF5qPuJ7ckFt9047KWDxj6t4Lo6nA4pTpaInOkraIk5T+XQXzqSDicUslkSC68b+M2CPEICY6qc+jyCZX2fWDuZ8aqqZPO+cgDcfuq0IXjXRlpXDXyQOD7o9G5ZPDfTajwb+/uz4r5921c1tkUuQWET+Xg/3HtspZMeXPjFKQa7pi1JhoCPmT/hJlfXLD88fZ8GtLRHL3fEPQDZOjam1asew/jlIEyLkB2rFUGEbEXbNKaCE2bEgh+6tro6n9rb677HJguXrhs44/LfPg04s2JyJ8w83sLlj/+VCwWE3804/ffBjCHBGWZdeMvdl6xcza2G+H4kYTZkxbI+QmMHojz/97eHLmbQGctuG/Do8ygkzW+tSzFjbk78NyVqP+KYhxcuHz9kx0tdXXzg/pfOvuMRgjaSqzvhTC+Ou/etftO2nF3C/9R+7r6yR3NkWTno/UXAUBnU913O5rrawGgo6murqtlcYNnBJYhcPpRDQBob4k0tLfU3zOgvBLRp7paou93NNUtzD/upDT2CGCOxWhB/fpD0PwEDF7zwur6/wOiS+fvvGzT5pb6e4SkwLyGdS3JZEiWNzhOP/EKxDj+ZV3dtbo+BAAk+Je2VuEFyx9vP2VsIW9rsqO5vnZzS30LAHQlInd0NEXv91w35SE/vcUb4/ZE/Vc6mqJ3DsbGKbfEAEBXS3RRZ0v0q2UQn5lg7myKftWjlqfc+HtA7lqz+PrOROTB8eJFZTk1cNDREv3WltVLrj2lcOClv7S3hC7saI5+79mH7/Azg8pNXs5AILvj/uzDd/g7mqLfa28JXZiPkTHl52N94wDQlgpVmn3GN6wcVtWu3LC/7Cc+s8FMBG5dFT3b9GGlVWk/XBNK9QFjW+Z2TGdGKhUSRGBfn1xpAU/Urtyw30tyLA/pGerJcJOCa1du2G8BT/j65EoicCoVOjkphkfkO5ojSzoTi28tG3dlGdKT8Vj9bR3NkSUnJT48At+5um5eZ0tkOeDs6pWHryxH4cTzZLRElneurps3lsbfqDmyx4E2r498ws7Ssj2V9l8DR6rDl6UsQ2nm6X3GQ4afE3PrN354UthQyWRIMkAdiehDXc1Lz8s3+spSluEcAl3NS8/rSEQfYoA+doox4PRujny5q6X+tjIvLksxuOlqqb+tszny5Y8VN54vsK0pellHS+TrgFNBHgDxGH1Kme2M8f3gyKd0reT0Fxnzz3g5HsbhPge0cEci8vW2puhl+Zg6oRyZOSZSqe10bp98kH3ipwsWrz90hoVjUiwWo9mzt9M52/YSagC0AftmT+Vt22ZxY7xcgacQirH50dBkJcUDe6r034RCs7jUYLKSgDyQs9VUf4+APjR/+cZftbYuMtIvB8dsebj0sstw2QtTrEIjpTgZkm9UTTPefOONcR2A4DVpVVOzSRVinDDHRFtbm9i3byqHwintAbsrGZpSkfFnd7yVtc6fjYF3tv9guqTxOHtykPcfTNMXVzyTHmujqTW2yKg+95O+3OSDXOr95d+n7+BkCkw+aF8VTuU8HHU019eyxuSFy9c/WWq6W0nLNwjY3Bw6FyxD85Zt/KFTnrRubsBvbkhbShPzKF0qpIIBKTM5tXRew4ZNx3u41tZFRm3tJrujuf5PJ1T5vtnTk7MBPX51nwk2GBYT9RPQC8ZBCN4Lwm5J8h2w2mWYvncmTJz43uV3/uNRDR+3rlph3rB7uuqaseM7fr/8rzlLTdaaux3WMqplVVVV+mRPX+4bC5ZteGKohIZSlVVHc2RVVdD8Ql+/bTMgR/fqoCorDKMvbf3b/Ps23u/RC7cn4jdBKjX3vtRuL0i/mHOXMOAxIsR1B8t7FPMTnuuk/TFZ4fMZF1paQ4rRKWalNHw+A9m0qiz4JWl9lt+UF/YJwDDGt345EUBEEAQIQSAit+0oYNkCmZxl7d//0ftbVtdvB1GnAfyq5/z3ts6pdfpyMOMHXYnF/yEN+nawwgxLQejrtyAllfi+GAGfRG8f5gN4ou2cvaPly+QlmFIf3UokzpUGQdDoTqs0w2dK9PVb073fhUIpDQAW8xMS8h4C/pERE/kN68ccyLGYUyS6qzn6GQbvX7Ts8XdfrQr5gFROkNY5y9ZKaa2UHq2TW+UsWzJxwXyJIaycZWut2c5Z9rgieaC/l9sTkggMhpu7w0IQmYagGT5TzpCS7kxnbATfO++1F9csfoK1vYbo8R3Aul8DqOtqif7EkPR3lUHz+u7+rAVAgonomHaTx70flc5aEoSrAKCmrUYDm0ZhyMcoHo/zed3m+TD4/L50To9F2SAGlGUrCZCVpxQ4mQzJReHH3+1sjuzvao5+hij+4uBKrSNJ0YDbumqFqRmL/FN6n4rFYmI2kLeEkWBAADS6D3s/F6MlmdzvjP76I3wIJIhIgCCJIAEYIBgADAIJZrBlK93Xb6nunpydszRLIa4MBoz/ASFfenFtfXPno+GrAGBew4ZNH/R1L+zPWv80ocJvCgj23mXh9wOZs1gw85WtiYYAxZ1SV6UCrtFtXGlLfVVFwPCzBtNYvDcmwUyCiAOA23DTpRaxWEz4p/Q+pRmLtq5aYRZ7zwWDJZkMyXg8rtP+w7cx8+/m3PVMf2MjkCob4MPQQQfoIBhEoJxl6+7erK00BwJ+s8EXMF/csrb+r55e9YWKu1Y+03/Tveu/2tNvPRQMGFIQaeZiOCIJy1YQJKabhn2Rq1ZLBrJHTSToBsMQA4vQmK1oBN8xk6cRmHPXM/3M/Lu0//BtcTdtasyBHAql9HOrl1QKpll7qtSvPJpRxmzhYAORwQzu6c3Zlq2DVUHfn3+iclLbf/wk9EkAmH/f+r/pz1jfrKwwpCAUZ6wxVEXQkEKpWQAAV6uWIvv2TWV3Nt6gNYPHMNyXmaGVA+TGo1bUuI7FYmJPlfqVYJr13OollR5/HjMgO8mi4AptfxaSN4fDKdVYRmbp2ppgaIAP9WQsvyk+PWGi7/lNPw19xgHzhoe7e3N/XV3lN8Cwi8GIlAQGrsvXqqUaeltXrTAZfHXO0i5tGzv7QggHd42NRxt0jS7NgOTNFdr+rMefxwzIoVBKdzx6VzVpmvnvb12xJVauCjQm3INAZm9/ziaiqcGA7+deZfiFyzd+p7s321ZZYRrMhWlmBkhrBkDX5mvVooHmUpJes2eGEHSBZSvXTzPWjz/EL+OOVv73t67YQppmdjx6V3WhWnlEIHvaGGbVLWToLfF4XJe18Vi68sjIZJQyDDHZIPq/v000TGIGaUVfyeZUr2EQFcSXicmyNBg8i4/43YsGYBvahMuPr64ImAZrlHSe46pkGh53jXAqd5Kht8CsuqVQrTwikEOhlN7Z2hBgrWe+H9AvMDOVtfGYs2fZn7bs6kr/pb2c+Uci8MKvrH87Y6kfVAZNAYYuZEpYtgaBLuxIB87z3GhF30yNCwyJG1y/9pgZekxMzAAx+T3X21BamZnp/YB+gbWeubO1IVCIVhaFaOM9f7AWSCFeDYdTKpUKl7OhxwXMZHT3Zu2qCv+Sjua6zzJAUlc8fLgn977PJwRwfDATQEprHfQbfmJ9Rb4brSgct9W4zST1DUoxMNZ5nWBozb48t/Qx50+lwiIcTikpxKt7/mAtKEQri5G0McdigrWehaDVya4hcMagi6E47wPvA9YYh4AgJzqMmZn+d1vrIrng/qYesP5JMGBQIVqZQNo0BUD62lIMPgbIq64JxuycpYAxNPTybvS4oAyHU4oBQtDqZK1ncSwmRtLKwwI55iaNds544xpN+GBeOJVOJUNnjDYmAiorTFldeeRTWWHKYNCQPtMQ5GzrucAeuwFOZ2xdVeG73rdr+u3MINJyXU9frl8IMnikyUPuFNP4FADUFGvwuVTEoOwlUtK5lq1R7MbUSBYeuxx5pOTTVDIk5oVTaU34oHPGG9cQgY9XqWh40j1g0elPk40OT0OfKSBmzXZvOvdcb5/1dG9/7mc9fbmf9aatn6cz1uacpXYyw/LAzQCYWY/RaLMgMBPuJwLPv3/9O1rh+WDAwEhamcHCUhoAZjODKFzceHmGngCuqQiYgsdykh618hCFCrDNAMDBnv700Zg8Vozhjem4/s/Hlp3Txxmx8P4Nu8+UDRBmsBRENqFPVEy7e17479ODj3n24Tv8kyaffUE6bc+FoLApxRdMQ4j+jK2IRhchxgyZzthEwK2b1iyevujedXtA/KwUdMeI8c1MZFkKAC7uWrPkHGDtXmYncKNgQy8OAJgjiMax7Csbvzk4WQDDTxRPAy+4P767vSkq/vOxZecQxfdhmELhYhgjTwBA2ui/kSReHmk2nKaIJiu7d1IyGZKtrU4fuWQyJJlBd37j59l5S9e+eVPD+jU33bvui8Q031b6hepKnxytFiMCKcWqMuirlrae547S5r60xSNxSyLH4Av4ZJVgdblnOBWskT1DD3S9PQ6GnvNaGQJkbu/e6YNHNUZgBSTxctrovzEfmwVp5FAopZlBHc10kay0/8N5SWeey81gUuFwSg3O8mWAGmMxapy9nVIAPhNe25WMhW6+4BJeW11phnr6rNFqZpaSGIS5AJ4whNxhWepDv09Os2ytj2ukM2m/T4qsra4B0HFOgQaf84xx3fqjUBUzz8rZCgwIGlvdQOwQfXnxZReIkSe1gzkRtH/HfXK54+kYmi6JoR8I3PZo6BIiHJ4XTqXLCaXH2lTxeFxTOKW83nPheCr37s+saF/a2lIRNOQojUBSiomYrwWAm+5d1y0EvWEaAig0mIidreoiLD0CAF+1vMw0xFTb1uywi3FZ7mQgZxQcHjEvnEoz4bCLSR4qolQc68NzVLfPlNcZwngFALa54XZlGVpq45tsToZkOJVSKsv327bOkRhF0xdicj0GM599+Ot+F5hvS1lQJJr7XVwNADU1mwqaUG1tjqEHpusqAiaOx1/HQBUI2ZctaJJ42DOE8YrPlNflY/S4QA6FUzoWiwkQTT1wcP/rwPg3+zsttLSrmReu2Lgta6n/ryroE6WCgZlIKQ1NPHVC5b6zXPS+W0jEAwPCsjWY+bKtq0ITh9Ngx+Gwc8Z2P++Y+wOBCZMKO97D3oGD+18H0dRYLCZCQ3hjxDG0AuBbLtl+ETN33/mNn2fLtKJorwNJSeu0QwZLWpqJnLQgAao0DUx2z/uhl4UyksFnKc2mIc/KVfguyacNx3VY1LQpABBE19mOC2+cOn4xNGD09yjfEWiPTC/u/MbPs8zcfcsl2y8iHDs5xVC0wlBylhZ4AzgSxV+WArxXjW2KCKxz/JvetNUvJMniAuTzyAWDTUMIi2gCAEjCQc1cUBUnAlTQb0BZ6moAaGtsEyMbesStiYZJGrgiZ2nwODYTJYJMa1FwFoiHQS3whqHkrKHohRiKj4D4vIqAeh1wgjjKEC10gByM7Z6gPiTGe6YUQBG5d4OhLElAa13hDCL1al2gmnR7xAlBjsFXc/zDPVAEZPaTPkNMscbL0HOtBgJJP7F0XGyNI09MF4MVAfU6SJw3lN0mBvORrcnQRCbiOeHU4Vi5XUIpKyeFwynFhP1SEoip9BVNAAbIdJb8onYOyXYyO65xDLma437Xc9EphU8F/QZoHA09hrMDaWhRFLZisZiYE04dZtK8NRmaONhuE/kHAkAuS5cIog8AYPYo0mXOWGkc4KOZ0dBMYidaR7lBO8ou3PMGAlmWAjOu6EqGgvF4vMAkaPr0ieCRxCBbW0UB2cOiIPogl6VL8jF7FJC9A7UtZ3JO7QSAUChZphWly6hWMyYmzQAzcs4AQorCJ4awbA0pMI3SYsagCTaEoee46Ij4WsvWYPC4rMTk6mQGkT9Q3Hc9LHJO7dS2nDlY0YojB7ouDcFTGJl3XM5XNvSK1shxb283yMyjQTIppWFK6nV+oatJFO4VY4aqCJhCM80GjgQEDW3ogZ9/LHSOZlzuxGrQeBZEBBGktJUfODoBdQT7wy0nknkH4ClHYTYfyETg1h+FqqCBBfc/3VOucVyyveeGG/IkzQwuLZ6XhQDZtrYF80EX12cXE8hDbjKqdpNRhzP4PENPSvPKoN+oVlrr8dvRc0EnCDmmomtXMIMW3P90DwC0/ihUlR82ILwDAMAM+M5jwuGh3BtlKehFAwBuP3/7JGZMtRUDTKXU14MUAgw+kOuT+1zOfEGRRhVpxSDGcZNRPUNPs77eb0qAabzpJBMRbCgHyI2Ff9HDJBMOmwHfUUXlRf4BJNR5pHmPo7bL/uNSDT1tmBcaUkxWqjQ3FgHadEIRdi386vpDLrO8zK3aUtD5iJhyTg7fla2ti4zhklG94HtBmDM+8W7HTlJBgJA+F3uFOxQ8TJLmPSTUefnYPdqpLPkcCOx2nXFlIBcpbTVtghkkiOdUBEcVr8CmIZiJ/hMA73j2635mzM5kVTHVh5yYC8IFgV3Tznet/GNAQ250H0DXuFnYorCz06iYtK10Cd92MSmwW0g+5xjLesAi1LIKduVejzOXoVmc7Ns3lYnAivUXucBduGFpgWaSgn4FAAf37rvU7zNmWLbaBfBHhhTgAoKHWLOqCBg+m+SVwLHJqJ77qvOxyHRmXJorrIYFS0HQmg9rzX2ihEBPAiDt4sNcBzBpV+5lLavysSs8i3DrqhWmIuUkPJalaPHqCT/fUne5zzRu701bTFS8C44ZbBgke/pzB32SWwHAAt181sQAgWgnEd42TYHjh6QfOZ1hCAg3HHRwMqrnvmKB2RUBI6i01jQCuWAwm6YEgG0A9htSoKhteGIWggCDAqW+6wX3N/UoUnLrqhWm580QHivKBvsngyjrvMzyjl4xisLloBoADIif+Azhh4YuhXESoCoDJkBIzVm8Yb+Lni+zo4MPg/GqaQgQCjDKvGRUcjwXgw0+z9ATQlxvmgJUgKFHTCwFgQgvEyFTLL0gJna28pVZyssewCZRNhvsn+yd1nD9eoBSUwiOz7IYAn46ixGQIpkMyba2vZRMHgFByNVuNfumMoVTqrZ2k/3sw3f4J0+e/NOKgHnrKDJEWAiivoxlEdPfx2Ix8Ucz3rjGlLg5nbEB4iw0/bbQgtsMFpatwOwmo9LRpRw8YDPxHF1EIVpnLaDfMvhmcgxLLsr3TAC0KKmGtYdN0tQLqCkA9jIDhmNpx5kFJjPocBm+R8x+f0b1hJcev47Hjmfv8B/66KzbNbgx6Dc/1duXKznNiTWrCRP9xoHD6X9YuPzx1wHg1kTkIZ/PZyjNICYb0L+znXhjQSNhh4lytgbAM19sbvgE0PJBXgHtgar06MM13o7eiE4WgszmbGi2XxYkVCluDgKBpFNmIFTi8LCgwwBP9rxFRsrbmtY80S94P1DOCHHUFBv9yl74/GORgyQ0sR4owB0wJE8B4SJiuu7APprn84vLWAM9owCx1lCVFabR3Zt7fXKV/gsA1NYUnhM0jbr+tGVXV/kMEEztk6/1pi0lhJCamY/HaYlAWmsd8BuV/encJwF84PFiryr9JTnz/Ax4Rs7SIxp6bmgpWbY6GPTJN7M5GKVEqRIBWpVW+MXDpg/6UFbjbABIzd5OeUEXVAlwN3Bsuc8zSxE7VS2JqNIw5b8F/HKL3zQ3B/xyS8Avt1QEZVtF0PdkdYX/7ysrfA3SEJf1py2dzlq6ZE3MbAf8Utq2Ppyx7NBV4VRvMhkSppA/kZIkAxpO3IVcuHj9QWZ+z+HJBRh8TNpvSgjB1+TzYs+D0ZfF1RVBw8ea1UiGHojZ8W/TrhsWb/jI27UsMU61JI58BJvc7WDWpYFHVAIHLb+3r18WAMhZmodgHJx1QjNd5xo7bRhKAjAYxHZV0GfaSn3Uk7a+dMsDyVcB4Nx+4wcTKn1zDvfkFIkB74fjaiK8bhriomyOuMD0J4Dc2OQ253eeB0NIfYNhmAXhkUDakEKA+PcEcAdgFbvf4/ZcgRDaDwBt20qr42yZ1Is0BwcUsaeqpRAGs0iXfchHa+fBn/yWCo4iKB7EDNbMbBuSaFJ1wMza9q8PdeduvuWBZCcAtD8W+ZOqoPlgT3/OJgHpBcoTIe3oHHpFyoLjLsh2eLKTjNroRLodVZVeFbhjyE6cBJhedQwu5IhQVMw1EZhA0PrY9gvF+JKZRVqajsG4bdssFp6qZigpTStThu/4cm8iIOAzxMTqgCEEfdTXb/2Pd96wFtz231LbAaAzUf/fKyvMH6UzttL6aKrCmm13iX+p0JYIDIicrQHGpe3r6id7QU0DVemZrsrZBVelJ1tpQDhAhiC7pC0fAkA8qs5bB3u7s6yU9OiG4SFckyBr2wdWGW7jJ1IQwMgqpX+fzVr/ks7ZzYuWP/4uM2jLpYvPJ/D/NAy5IpNTSmsWg+M0SDqtGJTW2/szdkEbLkQg29bsM+VkK4tLAfy6pgYiHoe2qnpmSBuFV6UnyL6MpSX0DndlyZTce0+PrrRY9e6enJ5ZTZ6WFsCRzuy18U12GW7jo4yFgCUJPzcNee87fuv6OYvX/eWi5Y+/m0yGfI88ssJQtrpWShFxt3+H4dTOhtUECr6tlN5nGKKgavZEUAGfAQ0nGfW89AEJACqHa4KFV6XXboGYDzJB/a6zMKCPSigQRwAMQzpfqynthXpY9bBrAEDVnh5DTJhS5sXjSLe1hqnBt5C2b7pQm3/xwur6ThClbgyv+w/3mH99etUXLpkanPC/qyrM+/szNly1THkeiDQAfGpZy6HO5ugbPkNMtS2tMVJr3UHJqO9/2O0ma/CcgqvSO643WLZ+qzac6nURWfwK7vkcUPoW9YCBx8RVe3oMAEoAwCS7Wig3UKscUD+uxqNPEE0ypLgqGDRXGlL88sU1i3+9Zc3iKADctfKZ/TctXf9AOmsvM6XI+QxJA+VqiUDgTJ4r7FVDFtwDj2ylwey44DBjl+2ckq4voio9G05W+PYj84osgEpyDjCzv+TlzcWogsIku/pIGKevanIZvCeCXzCgNHMmZ+ue3pydzllaGmJO0G+sf3Ft/S/bflp3JQDMXbq+OZPNfZ4E+gxDErtuN85rv8BMLxWxlntltC5/bvWSytraTXZXMhRkcPFV6bV4Je+B0qVVoAEI2hyLd+phtxwc9PF49QTIafebzli6pzen/KZxa1WFubn9scjdALDwK8lfZrPqbkOQEsKpewXWR2wYrV/N5hRABcUPC8vWEEJMC2r7EgCw++VlQhRelZ6JRc5SYIXteQ/STyVVuCMopjHtF+6UAOg9WObHHxuqSZCA7Om3bFvzxMoK88lNTZEGAFi4fOMvejPWnwR80qc1M7nRiQAgA7Qjk7P7hBCiEIOPGaoyaBARX+UYR3RdZdCkQuo5M8CShMjk7IzhpzfyPA8lp0URj02mtoddAQCHjB4tXXuhvBly1ODzMR+wdpvi2ABsxti0XCCCYdtKZy1bVwXN5k2PRj4PADVfefyRvoy9dlK1nxjoBoDW2CLjpujGvQDt9BmFVTMiJ7IOpOlTjsOh8Kr0BGbDEGDGe+k33/vA8xRw3sQqgV2IUbwrZxMPEoeMniOB9b3Tq209Ht17TnHxmYLyP35TUMBniMoKU06o8hnVlT4j4DOE04lp9NV5iEgoxbBtzQG/WLs5UTeDGeQTxjc/OpRJg5zl+Lwbr3GaeIJfMwqMTWan5jLglJtlZv5UoVXpmYmd2A7sqI1vsquqphmO1wC9JeU7OYl7o/ZaaGLqnV5tDwDZaznWGltklLWwo7mYuc+21OcyWXVT1rLmZrLqpoxlzbWyVm1/OndPd1/um719uSbLUtv9PoOqKkzJzJp59GC2bK2CfnOSDfpnIvCNDWs+6kvnfgjm6qPcZ6CXnC3jQs7Lzq4c6BJnh48utdyq9IVocykJIGdHL+heXwMlb6CpUXgt8rHqYdfwCnQI1uyfPdUEcMZvirjbRXaFkO3XLVvbN9ILrbz8wvlZy/5WZYXvrnTGYjd6jkoHM4ye/pw9odJ3+5aW+i/duHT9088n8E9C0MUAsG9Xv1P3VdBLtl2o+4zItjWIcA5ZdCvAZ9tKo6Asby/ThPWrR/9e26XGvolRblH7Z0810afZc8cZjW5gPUEq25IBAOkyqXDW02xAVieTocw55+yl/DShEI5Ebbk7TJsAbNqyun6FKeVPbNKkFGNUhU4YpBSzpfVfoDH2s0Xx+LsA3gWAbZjl+oHF6+mMZZOA4Rp8x7seuTWbKwG9hAQZhVZCYoZMZ22woNcAIN39oWNgsdFfqkVFEI5R1laiRrfMgOFmqTc2xsjwAq2V1jYRggAODm7+cqaKnVE6vPTYZjiDJZkMyXPO2Us31a5/pL0pkq2qMJv7M7YCRhFPQJD9GUtXBMzrO2e+sYgZbW2Ni2RtfJMdjzuBXhMC2T8c6pO7fYZxoWXbXEBgPNyovc8XAWI2DEE5Wx2WlZVvA8DUwIXadcn1o8D14NjzlmaTeWNBpINKO+xhdn5gPQSlTYuryqq4eAm7eXvJZMi3cPnGlt5+a111xRi0KgNp0xBM4KWDJhJzLCauCqdyRPR7nymA4srXFr6su8H0grBzXvixAwCo5/LpzpKubc2lP9yoqIVpcRUEDbAHccQlyH2AUx29sTFW9mCUIKFts2xmJhIc689aWeEExPMokCwyWZuY+fatT6+oqI1vsr3QzbaaNm9/+mUpxq/rB4G06dTReN1dfQTa2jzDNFtKxBA7D1GS1+IINmmCg1kXyF5ZeyHocA5ikqeqy7AsYdDjcQ000oL7Hn/LsnVbRcAkZozGzywsW2m/z5je/1HvpwCnR3M+tySil7iA3iKj4OogAQjQK8CRVCkA0EL2ldIrxc1YMQFg3+zi+mV72MxBTBLCSZYObZvFYqAMqsZB0jyxDMfRSVtbm2CApMC/SjEGbXCZdMAnYQq+MR9INY01nudiWzprgxnj1bSIlGJoTdsAp1ZcjQs+AeRKdjfy6KgFaZ5IGgcdNR3nI3HRUh5gwW4ZonIBw1Jl376pTAArLX+dzioweHQAc2eC8hpADlj5jgLK2r1v52x1wCwwNrlUo5OIfw8A2DaLU95ywVDFXtKJXGOAS3svHjZZcBWkPOC6K49wOH+64iBcJ/WZ2K53zHiyW4vMsNXOnKV6DTlKgLGTcyfAlzqauM2tLu/0K6ld9tQhIfCmu/M21uOmTUNAa/7Qn+v5g6f9BlxgQIZ1qTWgS+NCA9hk9vvTFQe9tyQ8V8iclY9YkqXqeHR5dRmOo1Bg7hJ306Wf/AjgfVIKtxJPqSdkUpqhQdO9WmcDBl/jIifmQWObYRQcm1zMJHLT//HWnJXP9DPzUW5ILXS/0sXVgCbPDSic5NNSVv+OR5dXS5ZqzspHLM+N59aoDXv1kXth9E09sgSUpTTzCES1cZsIB6QgjKoDAxMprQHwJBVIT0A+XGsGsP7SeDWNdoLpndDNtraao+iAtqUu/bngbFE3FktLABh9U0mo3nzsHrXPrhXtg8a5zv/KLriSB8mtQ8ygHqeGAI3GBQfWABEFMkpW5LugvN1GKejlnKXBND5NbDyPxWCeahBbznZ8sSBmEGAWieMjmNQ4Vyvad/Q94khTEdbyfRY03UF62QVXqqSOuC8zY9ZWhkFCqqPO5tUk0TB2pHNWRgoheAzphRNMr6HheCwGtuld9PkMStu6eOefV5LMmZSFV7XyMMmCprOW7+djV3iGAwBYmdz7xJiYf0BZTgaiAjBYkWUdFdDlbVXPbZi5hxnvOHyWeYwuy5KESGftrNLqzfyJ42lRzZQjZuXaBcVdt4Q4FA+TxJhoZXLv52NX5POP2q852bEdj95VXY61GIXnwh1wwtj4dl2Y2Bn2gmQGtBgnkyFJFNdEeM1J1x+blnJeMD2Ad/U7H+zJnzgDXguhNUC66Gwn9pxmxRrS4I5H76oGgNqvpXrz7ThxRG17XZzoACFwkefNKMOyBDlSaK9a6zHAldOvQ1dMVMfE/3obJMRObDKNEbUYCKYn3lEb32S7BbYdjdzY6PpytcUEG0UgmYldH47n6i3smx4WHWzSgaMxmwdkb9kQhtpJPqezpGcRlqVoDxwnkyHJjLN0yX7WY1xWtm+I5jpeVyYifqmI1P6CbEy35sU2x2OR33DSuYQwVAbgXEmh10X22RvwrPnkTGE4nXnzyx+LPL6lAcDn57c087TBB5alYBcRAGBaD6YwMM1WuqRee8cgmcju2TtENJ07Rsz0Wn/G0qAx2qp2vSUabp23tmMPCfZVaDAV3Z6JwdBgI48ajHiKAcOWeZrPz2/lY/YY95vXgZ2YaagO7GUpRHN4TQ3FZQGfUW2X2GvvKHeFw1ltf3YIIHuxMpX2O0rjA3cDQ4/BhJTpnA2h1WvA0ME9ewxbU5HVhrwNESEgimlKGo/H9dZkaCKxoDnh1OH8hurHAHkg6o3p/f6MvAIAOFZujFOMeJzVlGJ+wC9BoNHFJJPTKZQZ6r1uF8h09N9jsZiYF06libDDNKSj8kYHYjakIMvShw3pf3s4L1bQfi/H7JaWLXL3UuvCs6g9DPZn5BVg/f5RWB0KyN7N2lJtFxqXAUf5RMtSgLS1OVFptuJ73Oo+Y/L+mMkONbopToN5shubTBqvGHIMYpOJ2TQFCLzrxoY1H3m8P2/yAAD2VU61uESOTIAIFVjk28Og0LjMlmr7UBNLDJ79DNCv3pr1DhFNePbhO/xelmpZRpZkMiQb43Huao5+JuCTN6Yz9qg5q1dTmQRbw3ajdfmrJv3SWJh7A8H0hNfc5xpSe4ZCs5gIRbvf2MlXMn92brUv364YTsLhlHr24Tv8RDThV2/NeodxbOrZMTeYSoacrj/Me6dMPvsKjzuf9K4CQDOgGFDMx/9gjIqqDFqO6eKDkwU5NSO+7zMlYYzCKh2ODCtv8I46r8dfWdOrmbGITXaD6b3K9Oecc4zmdD0lcQ1NRWlkZoeEMGBUTw6OiCsPe1Mmn30FmPfG43GdGmJiGcfOMkdl5yz1O9PETQBeOhUyRjSoYkKFT9o5JaVBw6s3ADlbI5uzdam9PwaPOZIhkUoB4ZWPWJ2JyINVlb7bevssNSYeBPaWSrLz7aWhxsxvmG/mLPuwYdBE2+bRGJlOMRe3Mn3NvmMNvYGEXOHUfyOmosLMCCyrD478fjzs2dq+2rLUluH4ujGUceG4RVJvdTRHbu9KhoLzwqmTtkTAQC8M0i9192V/1p+zFHLDvCAGOQUn+MqKoHlxf9o+7mDbxHJww8iBUgA1bhB9OKXg0q+u1fXf8RvyB/1pW4HGpkAkuaUyHWrh5rvR0GNGtOajjkT0bdOQn7KVxSi17bkbTO9Vpsdx3LAEVqVlUZOUvooRvxkOp1RXMhRUfZhYc3/qLb5/6Ix2YzgXUjicUp0t/I5OG9cB2MwcEx9HwD0D1OgYBTTcgwKg+fdt3ABgQyHn7EqGgpkMraoMmvf2p4fTnMSmP3doWBsh7vyz9ekVFfpQz60M+lYgYNT0pS2tNSSN4RpGBGjtaGSvDskxNLlxkQQ22QRsMw3xqUyWNEqrr6ZNQ4hcTu0NnD3xnQEXX3yQ189rNMqwi/cju1OMRwK7gzmdNq4TQr/jbTQBx46JMQw4tONeqXihjzL3ANjc2Pgx8F6GIoAxcksILlwTxARRPN26Lvotytp3C0mVSh29DDvxXGxyn/Gl5xORQ0RMkoltON2viHkKEy4i4BrrYM+n/X7jIgLgte6lMSdiBIKjkRuPzKFBrgv3D0QvEbAEpSakDlSmV2/OuesRN5j+2PgN7z4I6C/Fa8EMeciXO27enoc5VrimgiuezMdmQUB2DMuYIIrv60hEdMejkXMX3B/ffcIKtxBENqegBf2kszlymJnEaK/LDDWh0md0JX7/JDO+/7NHqvtNX/dHfp9RpbWtvWWYyKnII0AVgYCxYTAYCAS3qTg0M7I5hf60pQnEROOWAAoiyuE4SPZ4rK35lYLb8Q7zqgwpAO1UFXKD6e3hXGIAZbw+IlTwWDAANqy016Ls2G87WIvrjkcj54JYX788se94rMAYaTYA4tds6AUAks5OzAlxx5HWDJ8pL5VibGaOUoyKgIHu3uwrRODWHx0U5JN0PBXfn7X0kD3kPH/EKBtGFkMtwI5GHi5OvNHlsYaPXk9n7JwQwjdSi9/jgo34lUJfbdEuGMd/Jv3C77YXazyGaHhYYwMLiMWvj8ZkEUCOx+OaGYTGy17umvH7m7uSoeDccOqE9uHLWbbmsdL/THZ/xjIAZAAgN8HPPmWPtKCLYWFAx/wwXjaCZ7IddyvYC7HMnff++75d575rGuKSnGUXbfAxscjZGsQ4Oph+sHfryOPnqIQ+IgyWPkoPu4KFwindlQwFuQ/T5u267F88DT3c8cfVJKlUSFA8rkmI7Uib8wke2T5hLFkQjdUHzr+gU2qn0gEIgUnkRsJGMhmStbWbbCa87jMEuMjY5PxgejPIbwDDB455RRyZdV+x7RccEwRE0hxyLJLJkCSAVa9cQEJsp3hcjxSXIUZyfTCDpl9odiitr0omQ9JLdy/LCQSzw2asozThEDKwccF4WcjiY5O9YHpivNc3behg+mMn2ogTbIiFjMEgGq5oViiU1MlkSIIwe/qFZgczaKQd5hG5XSoVEjNrWzIkxM7zMuJGIuJyINHHgGQgl68Jh5Q2b1Sp4Ba/g3y7Xvr/jtrao4Pph/SSOF8qtp42uVl+QmTZ59mvA/cQiwki4vMy4kYSYufM2pZMIVFyIx7gaWVYvb9iW9wUi8VEYxlaJ06OoHHEcEmvjJZQ2O5u9ogi5ws7Zb54iGD6oUVzafW0pQDZFvuGcuvFYjHBtrgJVu+vCtHGBQHZ08oL7n+6hwXv/Owlr98Uj8d1WSufWNGu1+L4LW/dMlr91k67iBa/RyHZsS5fOUrDHw9ARP0lmB1MJGDBNpGnkjkWE/F4XH/2ktdvYsE7F9z/dE+hMcsFHeRp5X5h/DsUzU0mQ7KslU8wu2AakYs6W9VMtV9L9ZLAG74iy2gxQ2ZyNliLYYPpj5lg0EW7Y71tdimFWyDIcSk2uoYeFM3tF8a/F6qNCwayp5VvX7q2TxNvn94rb3Hcc2WtfKI4MgsUZFR51YAI9EoRLX7dYHqibE51G1IMG0x/DEUAZUupQEAAFFNeFr+jjaf3yls08fbbl67tKyaDpOADw+GUisViIpid+Esium7r01+oaGw8vhVdFgcgcNL47dEUMyRGrrjr8kvFuSyYTVNCCNp5Y8OaA0Bhu7gM0ZdnkBb3TOpIUm5jI7D16S9UENF1wezEX8ZiMVFMLHzRGnXOykcsQdiUPVD1pXg8rrcdVbuBtbOU8Un4ce6L88pXMZy+uKO957wmkgqAPdBM0u2/URE0ZXWlzzBNQU4LM+e6hd83NKEwIHsbGKzp1WxOubZiQddRhiQNxutwfNLHx0abR3Y5y3nvt9BnEgIacHrtzQJkPB7X2QNVXxKETXNWPlJ027Oiii17dIIo/mJHInLjpqa6C2aHHn/PMUaE8JmGsJQWLvU5qcS2tc9nGgDZ5hFOSX6faQjWLKiUe3bJHhEgiCAEQTidpsEayORsKMX7c5balkvrnwNcPbna/73etA0pCrOQnPuWRzVUP544fn6CMOWObE7lgn7D57YhO64oxSLgM9DTZ20HhgymH4YkK5hGQAhh+wodd80Mv2kgk7P9ADA7lLI2NdVdwIyz5y/bsKGUSMsSqobHmQHaTOpJARkiwg+ZQV0J1Z/L2X+wFWtl2ychdxZ21lIGgL0AkE1XcJWve2c2Z+csxRol3TOBnXjcLIF6CTgIwocgekcSvSGZXreDuTduDKcOAEBXInKHYv6DbWulCi4ALuxsThkA7y3ojtxItXn3rt23uSXazsxX2Eo7cVDH56wqnbEkk/51vmYf+XpyfzZn79aKbaUKeyYCVM5WErZleYFoXQn6LyCVclaQeAlt2kuQZDIkw+GUam+qv0dAH5q/fOOvWlsXGemXgxInsVx62WV4P/iyqq11wkJfTYZ8f9jTM6ot6+A1N6qa2rg63i5aLBYTNWgT1ed+kiZk/OJNvFH0ff+u9wO72PzJZDLku/jgZCM3+SDvP5gu6Dm/uOKZdDFxE8lkSF58MO3PTQ4WfI2zJwfZdzBNwLnWnJWPWJ1NkVs0xKSFy9c/6WHrhADZszJTqe00vVd8e6JfPnL14vWHCGduvTgnwCpGbWgTqHE45L7ZUzkUSulyHb3h8ffyuvpJ3Tn9wO5K9bdOMusJTt6IxZylqq0pellHS+TrwEB/YOKT9TMoq2yszluMQmAe/X0XfC33u8V8Sp3ERX0A8npJdyQiX29ril6Wj6kTLl4kXGdz5MtdLfW35f+uLGUZCTddLfW3dTZHvnxS4CaZDEkGqCMRfaireel5A8tsWcoyHAUD0NW89LyORPQhBmgsQExjcWNE4M3rI5+ws7RsT6X918BAUmhZyjKkNp7eZzxk+Dkxt37jhydN73MvgKhzdd28zpbIcgDgMsUoy2CceFS0JbK8c3XdvHzsnHQzraM5sqQzsfjWMl8uy5D2VGLxrR3NkSUnNT6O3GzkwdZEtFzNsyxHrditiegV7YnIg+MB4jE1yjwi35YKVZp9xjesHFbVrtyw/6ThQGX5WIw7InDrqujZpg8rrUr74ZpQqg8AxhITY6oticCNjaDacKqXhb3GNLHi2Yfv8Jc9GWe2h+LZh+/wmyZWsLDX1IZTvY2Np4hi85aSLauXXNvREv1WmWKc2ZSioyX6rS2rl1x7SuLA40DPPxZd1NkU/WrZ+DtDjbum6Feffyy66JQef8/d0tEUvbM9UfeVMpjPLBC3J+q/0tEUvTMfC6esxNw99fbmyN3tLZGGMpjPEBC3RBramyN352Pg9Hm4pvp7ulwwlznz6cuJu1oiDe1N9feclkprIFCkOXJ3V6L+K55Vyyh7M055AOdF6HUl6r/S5Wri03bl5SMbJp/vbHEMQA/QZTicomOaN3adLdGvdiYinz8tOHGhmnlzoq6mPRF5sDXREChTjVObSrQmGgLticiDmxN1NWeUDeQ96Kam8PUdTdHvda5eMrVsBJ6aY9i5esnUjqbo9zY1ha8/I8cwTzPP6EhE/7y9OTK7DOZTzHhvjszuSET/fHOibsYZPXYDO4BrFk/oTEQe7GyJ3l7mzacMH769MxF5cMuaxRPK1BBHN6Nsb4k0dDVH7/fyucra+eTTwq2xRUZXc/R+b09g8Bie2TM9z33z/GPRRZ2J6J95yxXHYqLsovuYx8YF6uZE3YzORPTPvC3nsvt0hFnf1bz0vK6W6EObm+s/d2RZK8/6E08ljrzzzc31n+tqOZKXWV4tC+TNANCZiEbam6Lf8LwasRhEmTufGC7speZ3rl4ytb0p+o3ORDQy1BiVZYQX6S1ZWx5bPKuzuf67+YZgWRuM/6o4YNA11393y2OLZw2mgGUp4aVyMiQ7murqOpqi3+porrukrBnGdyXsaK67pKMp+q2Opro6b4fuZFceJ/3sym8huzlRN0OT+BJYH5CG8dRN967r9gaB4vFyt6kSAey9uy1rFk9QNn8JxFME66fmLnt81+AxKMsYLnkdTXULOxKR73QmIp9vzQsRLGvo0jRwa2yR0ZmIfL69qe67HU11C8sU7oQYIc4AbF21wuxoqvtSV0v0oY7m+tp87lb2cBTmiWAGdTTX13a1RB/qaKr70tZVK0zHqI6dckY1naraJH85tJS6g5guAtHW+RXW8+RWOXIaXJarYTKDUqnQQCsDToZkZ795M5jnMPE7ppQ/P9VpGp3q2sUrQ9qaaJjko+xtYFzEgl6bFLSfvyqc6vU0TCOAM41Hs/vccfe5X02Gqg6ljZtJ85UgvJNj/y9rl7UcGvwuT0U5LVwp+cWhn1u9pLLSVosgcYUAfUBadXlGi3fstm2zOH6agjoWi4nZs7cf1dZrc6JuBgs5T4OnQeH1PkNuun3p2r7B7+5UltPKJ5g/KAxQV9PiOSz0HGISSvOrqtr+Ta2rpQeox7ZZTE6/5VOVfhDHYpQaBN7WZKhK9hg3SEFXMbEmLbbOW75uq1eM/XQB8GkJ5KEoBwB0PBo5lyR9BoSLAHQz8SuBTO/2OSuf6R+syU4FbT3cvbYmGgKmyl5FBl0NYAIY77DiFxfcv3H3cO+mDORTZJkdzI07E9ErmPW1QohJLPCh1vxGsEK9NyecOjyUgRTaNovRGOePy2D0WjqkZm+noQzXrmRoCmfEFQLycq0wQQj1odbipfnLNrw+HFc+HeWM2G5kgFLJkAiFU9pbWp9virT4fSJNTFkN/R4gusH0ITP9PqPFztplLZnhDKjUbKflrAdyoPQ6ZgNuLhes3nmHM0x3rFk8oZv4Is00UwPTtWYyiN+3IV+bt3Ttm4OpVv4zn85yRu2be+64rua6W0zT+BGD/slniLO7e6xnJlfQG32kLxBKfkYKXCQI2zWQAWG/bdF7RrriwxtWPpIuAhQ0uLOt2+uuYFBtWbN4AksVDGj/dBZ8qWY1STETkTigoXdVAG9fs3j9waGe8UxzOZ5RQG5tXWTU1m6yO5ojqwJ+w7Byens2p1+ueWDjLwAnh9AU4i8Nw3jRUuoCKUSLYUpDazWTGJO0og+Zda8g1jZTmgUdZqBbqFyvMs1+aVqZ7La9Vm3caX92HINUJ0MhcdEXApMUU0DbqkoYeqIhpGFDneUjMUUBpiSymfS1DNoHSU/nen3vLLi/qWcovnym+8vPKCDHYjHRGI9zVyJaF/DLmwTI6s2ozXuqrKdCoVn8QtObV7DU3/EF5Dv9/fbbdr96ovZrqd7OR8NXVVT5v5nO2tP8pjhk2fpfiPGhZpoEwRUCCGiQyQoSxKQBMLhbEJ3NzN1gYgYFiJlIcB8RPiFITGSB11lBCqacJj4kgUs14x3B1m9lLt2dNqu+5zNlr2Z9k1b80/nLNv7r1lU3mG9Pvli7ht6p7G0pA3msZOva+qtzNgef23n51sbGOG9uqf+mEGz5DWn2Z+0Gv49uu8G0D1I4pTa31F2pWTxsGPQdKxN4a7BmzOe821Ih82C//E5V0De1L52rEFr+BFW51w7t6dETJ0y+W0hEfD5jf3/aOrxw2cYHHc9K6JPBSv/GdFb9eMF9Gx599uE7/MGzJ1dzhi+ZUmn+1560/fbCZRv+imMxKgdIHStnZExCMhmSzKA5S9a/Mu++DS82Ol4JZNnawEx+acopIF7bk/P1esYik7wKwK4bl6z/3fyvNPUefa6Y8OITiMCzQymLpXpS2ZwUJC4hoc6fF06lPze92gbxn2jIFTdE1txPwGUdTdE7mWPCmoD301n7bwXxVQzQCwd+bvmUvnxC0Lwma+m3BfF1DKAR8TJqhxDjTHxobyNgwD3n+lVrl6U+APC3g70UBHCntj/UWv7MC7rZ/NPfT9U+fH5+eGMTMygeB8fjThbLG//2dVNa+7/Jpj7fMHiVbapfJJMh2bhtFn92xu/3Sug/fmFt/eu2xZMUi12gONcCvV3N0R2aeSEBHEOMOPfmR2RAas073q9QPyCAOY4ylMvUYmRXWFvjIlnTWKNTqaN3ygbL71Yvqewn/uS8e9f955HvO3G7reuiZxsW/5CYdlRVGGZPxn5uYcOGDmZQ52OR6dKkrxmGMLNZ++kFyx9vH2hPEFtkBC89v8IN4KEy/y3LuBiK4xHvfLxwSWan1a3XlLM8CmUZN3AP6+rzADgottcDZ2tskTFU3HQ5J640+f8BUqvC/emYUBcAAAAASUVORK5CYII=" alt="LBM">
    </div>
    <div class="login-body">
      <h2>Client Portal</h2>
      <p>Your private project workspace.</p>
      <div class="login-divider"></div>
      <label class="field-label" for="pw-input">Access Code</label>
      <div class="field-wrap">
        <input class="login-input" id="pw-input" type="password" placeholder="Enter your access code" autocomplete="current-password">
        <button class="pw-toggle" id="pw-toggle" type="button" title="Show/hide">👁</button>
      </div>
      <div class="login-error" id="login-error"></div>
      <div id="lockout-display" class="lockout-msg hidden">Too many attempts. Try again in <span id="lockout-timer">5:00</span></div>
      <button class="login-btn" id="login-btn" type="button">ENTER PORTAL</button>
      <div class="login-footer">Secure · Private · LBMD Exclusive</div>
      <span class="forgot-link" onclick="showForgotScreen()">Forgot your access code?</span>
    </div>

    <!-- RESET STEP 1: enter email -->
    <div class="login-body reset-step" id="reset-step-1">
      <h2>Reset Access Code</h2>
      <p>Enter the email your producer has on file and we'll send a one-time code.</p>
      <div class="login-divider"></div>
      <label class="field-label">Email Address</label>
      <input class="login-input" id="reset-email" type="email" placeholder="your@email.com" autocomplete="email">
      <div class="login-error" id="reset-err-1"></div>
      <button class="login-btn" id="reset-send-btn" type="button" onclick="submitResetRequest()">SEND RESET CODE</button>
      <span class="back-link" onclick="showLoginScreen()">← Back to login</span>
    </div>

    <!-- RESET STEP 2: enter OTP + new password -->
    <div class="login-body reset-step" id="reset-step-2">
      <h2>Enter Your Code</h2>
      <p>Check your email for the 6-digit code. It expires in 1 hour.</p>
      <div class="login-divider"></div>
      <label class="field-label">6-Digit Code</label>
      <input class="otp-input" id="reset-otp" type="text" inputmode="numeric" maxlength="6" placeholder="000000">
      <label class="field-label" style="margin-top:14px">New Access Code</label>
      <input class="login-input" id="reset-newpw" type="password" placeholder="Choose a new access code">
      <div class="login-error" id="reset-err-2"></div>
      <button class="login-btn" id="reset-confirm-btn" type="button" onclick="submitResetConfirm()">SET NEW CODE</button>
      <span class="back-link" onclick="showLoginScreen()">← Back to login</span>
    </div>
  </div>
</div>

<!-- CLOSED SCREEN -->
<div id="closed-screen" class="hidden">
  <div class="closed-card">
    <img src="data:image/png;base64,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" alt="LBM">
    <h2>This project has closed.</h2>
    <p>This portal is no longer active. Your files were available until the project close date. If you need access to anything, please get in touch.</p>
    <a href="mailto:bruce@myluckyblackmedia.com">Contact your producer →</a>
  </div>
</div>

<!-- PORTAL -->
<div id="portal" class="hidden">
  <nav class="portal-nav">
    <div class="nav-left">
      <div class="nav-monogram">LBM<span>Client Portal</span></div>
      <div class="nav-divider"></div>
      <div class="nav-client"><strong id="nav-client-name">Loading...</strong> <span id="nav-event-name"></span></div>
    </div>
    <div class="nav-right">
      <span class="nav-date" id="nav-date"></span>
      <button class="nav-logout" id="logout-btn">Log Out</button>
    </div>
  </nav>
  <div class="tab-bar">
    <button class="tab-btn active" data-tab="dashboard">Dashboard</button>
    <button class="tab-btn" data-tab="review">Client Review</button>
  </div>

  <!-- DASHBOARD TAB -->
  <div id="tab-dashboard" class="tab-content active">
    <div class="dash-wrap">
      <div class="section-eyebrow">LBMD Secure Portal</div>
      <h1 class="section-heading">Welcome back.</h1>
      <p class="section-sub">Your deliverables and project files are ready below.</p>
      <div class="phase-badge" id="phase-badge"><span class="phase-dot"></span><span id="phase-label">Loading...</span></div>

      <!-- Job sections or legacy files injected here -->
      <div id="portal-dashboard-content"></div>

      <div class="note-label">From Your Producer</div>
      <div class="note-block" id="admin-note-block">
        <p class="note-text note-empty" id="admin-note-text">No notes yet.</p>
      </div>

      <div class="status-block">
        <div class="status-label">Project Status</div>
        <ul class="status-items" id="status-list"></ul>
      </div>
    </div>
  </div>

  <!-- REVIEW TAB -->
  <div id="tab-review" class="tab-content">
    <div class="review-wrap">
      <div class="review-header">
        <div class="section-eyebrow">Client Review</div>
        <h2 class="section-heading">Rate your deliverables.</h2>
        <p class="section-sub">Mark each item <strong style="color:var(--green)">Love It</strong>, <strong style="color:var(--gold)">Maybe</strong>, or <strong style="color:var(--red)">Pass</strong>. Your progress saves automatically.</p>
      </div>
      <!-- Per-job review sections or legacy review injected here -->
      <div id="portal-review-content"></div>
    </div>
  </div>

  <footer class="portal-footer">
    <div class="footer-links">
      <a class="footer-link" href="https://myluckyblackmedia.com/about">About LBMD</a>
      <a class="footer-link" href="https://myluckyblackmedia.com/terms">Terms</a>
      <a class="footer-link" href="mailto:bruce@myluckyblackmedia.com">Contact</a>
    </div>
    <div class="footer-copy" id="footer-copy">© 2026 Lucky Black Media & Design</div>
    <div class="bs-powered">Powered by The BlackSuite</div>
  </footer>
</div>

<script>
const API = '';  // same origin
const CLIENT_ID = window.location.pathname.replace(/^\\//, '').replace(/\\/$/, '') || 'unknown';
let sessionToken = null;
let ratings = {};
let reviewItems = [];
let reviewCategories = [];
let activeCatIndex = 0;
let clientPortalData = null;
let jobRatings = {};      // { [jobId]: { [itemId]: rating, 'note_'+itemId: note } }
let jobReviewItems = {};  // { [jobId]: [items] }
let jobCategories = {};   // { [jobId]: [{label, items}] }
let jobActiveCats = {};   // { [jobId]: activeIndex }
let failedAttempts = 0;
let lockoutUntil = 0;
let lockoutInterval = null;

// ── AUTH ──
function getToken() { return sessionToken || localStorage.getItem('lbmd_token_' + CLIENT_ID); }
function setToken(t) { sessionToken = t; localStorage.setItem('lbmd_token_' + CLIENT_ID, t); }
function clearToken() { sessionToken = null; localStorage.removeItem('lbmd_token_' + CLIENT_ID); }

// ── PW TOGGLE ──
document.getElementById('pw-toggle').onclick = function() {
  const inp = document.getElementById('pw-input');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  this.textContent = inp.type === 'password' ? '👁' : '🙈';
};

// ── LOCKOUT ──
function startLockout() {
  lockoutUntil = Date.now() + 5*60*1000;
  document.getElementById('lockout-display').classList.remove('hidden');
  document.getElementById('login-btn').disabled = true;
  lockoutInterval = setInterval(() => {
    const rem = lockoutUntil - Date.now();
    if (rem <= 0) {
      clearInterval(lockoutInterval);
      failedAttempts = 0;
      document.getElementById('lockout-display').classList.add('hidden');
      document.getElementById('login-btn').disabled = false;
      document.getElementById('lockout-timer').textContent = '5:00';
      return;
    }
    const m = Math.floor(rem/60000);
    const s = Math.floor((rem%60000)/1000);
    document.getElementById('lockout-timer').textContent = m + ':' + String(s).padStart(2,'0');
  }, 1000);
}

// ── LOGIN ──
async function doLogin() {
  if (Date.now() < lockoutUntil) return;
  const pw = document.getElementById('pw-input').value.trim();
  if (!pw) return;
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'VERIFYING...';
  try {
    const res = await fetch(API + '/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ clientId: CLIENT_ID, password: pw })
    });
    const data = await res.json();
    if (data.token) {
      setToken(data.token);
      failedAttempts = 0;
      loadPortal(data.portal);
    } else {
      failedAttempts++;
      document.getElementById('login-error').textContent = data.error || 'Incorrect access code.';
      if (failedAttempts >= 5) startLockout();
      btn.disabled = false;
      btn.textContent = 'ENTER PORTAL';
    }
  } catch(e) {
    document.getElementById('login-error').textContent = 'Connection error. Please try again.';
    btn.disabled = false;
    btn.textContent = 'ENTER PORTAL';
  }
}
document.getElementById('login-btn').onclick = doLogin;
document.getElementById('pw-input').onkeydown = e => { if (e.key === 'Enter') doLogin(); };

// ── FORGOT PASSWORD ──
function showForgotScreen() {
  document.getElementById('login-screen').querySelectorAll('.login-body,.reset-step').forEach(el => el.style.display='none');
  const s1 = document.getElementById('reset-step-1');
  s1.style.display = 'block'; s1.classList.add('active');
  document.getElementById('reset-email').value = '';
  document.getElementById('reset-err-1').textContent = '';
}
function showLoginScreen() {
  document.getElementById('login-screen').querySelectorAll('.login-body,.reset-step').forEach(el => { el.style.display=''; el.classList.remove('active'); });
  document.querySelectorAll('.login-body').forEach(el => el.style.display='block');
  document.querySelectorAll('.reset-step').forEach(el => el.style.display='none');
}
async function submitResetRequest() {
  const email = document.getElementById('reset-email').value.trim();
  const btn = document.getElementById('reset-send-btn');
  if (!email) { document.getElementById('reset-err-1').textContent = 'Enter your email address.'; return; }
  btn.disabled = true; btn.textContent = 'SENDING...';
  try {
    const res = await fetch(API + '/api/auth/reset-request', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ clientId: CLIENT_ID, email })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('reset-step-1').style.display = 'none';
      const s2 = document.getElementById('reset-step-2');
      s2.style.display = 'block'; s2.classList.add('active');
      document.getElementById('reset-otp').value = '';
      document.getElementById('reset-newpw').value = '';
      document.getElementById('reset-err-2').textContent = '';
    } else {
      document.getElementById('reset-err-1').textContent = data.error || 'Could not send reset code.';
    }
  } catch(e) { document.getElementById('reset-err-1').textContent = 'Connection error.'; }
  btn.disabled = false; btn.textContent = 'SEND RESET CODE';
}
async function submitResetConfirm() {
  const otp = document.getElementById('reset-otp').value.trim();
  const newpw = document.getElementById('reset-newpw').value.trim();
  const btn = document.getElementById('reset-confirm-btn');
  if (!otp || !newpw) { document.getElementById('reset-err-2').textContent = 'Enter both the code and a new access code.'; return; }
  btn.disabled = true; btn.textContent = 'VERIFYING...';
  try {
    const res = await fetch(API + '/api/auth/reset-verify', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ clientId: CLIENT_ID, otp, newPassword: newpw })
    });
    const data = await res.json();
    if (data.success) {
      showLoginScreen();
      document.getElementById('login-error').textContent = '✓ Password reset! Enter your new access code below.';
      document.getElementById('login-error').style.color = 'var(--green)';
    } else {
      document.getElementById('reset-err-2').textContent = data.error || 'Invalid or expired code.';
    }
  } catch(e) { document.getElementById('reset-err-2').textContent = 'Connection error.'; }
  btn.disabled = false; btn.textContent = 'SET NEW CODE';
}

// ── LOAD PORTAL ──
function loadPortal(data) {
  if (!data) return;
  if (data.status === 'closed' || (data.expiry_date && new Date(data.expiry_date) < new Date())) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('closed-screen').classList.remove('hidden');
    return;
  }
  clientPortalData = data;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('portal').classList.remove('hidden');
  document.getElementById('nav-client-name').textContent = data.name;
  document.getElementById('nav-event-name').textContent = data.event || '';
  document.getElementById('nav-date').textContent = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  renderPhase(data.phase);
  renderNote(data.admin_note);
  renderStatus(data.phase);
  if (data.jobs && data.jobs.length > 0) {
    renderJobsDashboard(data.jobs);
    renderJobsReview(data.jobs);
  } else {
    // Legacy flat structure (clients with no jobs)
    renderLegacyDashboard(data.files || []);
    renderLegacyReview(data.review_items || [], data.files || []);
  }
}

// ── JOB-BASED PORTAL RENDERING ──
function renderJobsDashboard(jobs) {
  const phaseMap = {in_progress:'In Progress', in_review:'In Review', complete:'Complete'};
  const phaseCls = {in_progress:'in_progress', in_review:'in_review', complete:'complete'};
  const container = document.getElementById('portal-dashboard-content');
  let html = '';
  jobs.forEach((job, idx) => {
    const deliverables = (job.files || []).filter(function(f){ return f.access_level !== 'review_folder'; });
    html += (idx > 0 ? '<hr style="border:none;border-top:1px solid var(--border);margin:36px 0">' : '');
    html += '<div class="section-eyebrow" style="margin-bottom:6px">' + job.title + '</div>';
    html += '<div class="phase-badge ' + (phaseCls[job.phase]||'in_progress') + '" style="margin-bottom:20px"><span class="phase-dot"></span><span>' + (phaseMap[job.phase]||job.phase) + '</span></div>';
    if (deliverables.length) {
      html += '<div class="files-grid">' + deliverables.map(function(f){
        return '<a class="file-card ' + (f.access_level==='locked'?'locked':'') + '" href="' + f.drive_url + '" target="_blank" rel="noopener">'
          + '<div class="file-icon">' + (f.icon||'📁') + '</div>'
          + '<div class="file-label">' + f.label + '</div>'
          + (f.subtitle ? '<div class="file-subtitle">' + f.subtitle + '</div>' : '')
          + (f.description ? '<div class="file-desc">' + f.description + '</div>' : '')
          + '<div class="file-arrow">→</div></a>';
      }).join('') + '</div>';
    } else {
      html += '<p style="color:#555;font-size:13px;padding:12px 0 20px">No deliverables yet for this job.</p>';
    }
  });
  container.innerHTML = html || '<p style="color:#555;font-size:13px;padding:20px 0">No jobs yet.</p>';
}

function renderJobsReview(jobs) {
  const container = document.getElementById('portal-review-content');
  let html = '';
  jobs.forEach(function(job, idx) {
    const hasManual = job.review_items && job.review_items.length > 0;
    const hasFolder = (job.files || []).some(function(f){ return f.access_level === 'review_folder'; });
    if (!hasManual && !hasFolder) return;
    html += (idx > 0 ? '<hr style="border:none;border-top:1px solid var(--border);margin:36px 0">' : '');
    html += '<div class="job-review-section" id="job-review-' + job.id + '">'
      + '<div style="font-size:15px;font-weight:600;color:var(--gold);margin-bottom:4px">' + job.title + '</div>'
      + '<div class="review-progress-bar" style="margin:10px 0 4px"><div class="review-progress-fill" id="prog-fill-' + job.id + '" style="width:0%"></div></div>'
      + '<div class="progress-label" style="margin-bottom:16px"><span id="prog-count-' + job.id + '">0</span> / <span id="prog-total-' + job.id + '">0</span> rated</div>'
      + '<div class="review-cats hidden" id="review-cats-' + job.id + '"></div>'
      + '<div class="review-items-list" id="review-list-' + job.id + '"><div class="review-empty"><h3>Loading...</h3></div></div>'
      + '<div class="submit-area hidden" id="submit-area-' + job.id + '">'
      + '<p>When you\\'re done rating, click below to send your review to your producer.</p>'
      + '<div class="unrated-warn hidden" id="unrated-warn-' + job.id + '"></div>'
      + '<button class="submit-btn" id="submit-btn-' + job.id + '" onclick="submitJobReview(' + job.id + ')">Send My Review to LBMD →</button>'
      + '<div class="submit-success hidden" id="submit-success-' + job.id + '">✓ Review submitted! Your producer will be in touch shortly.</div>'
      + '<div class="submit-error hidden" id="submit-error-' + job.id + '"></div>'
      + '</div></div>';
  });
  if (!html) html = '<div class="review-empty"><h3>No items to review yet.</h3><p>Your producer will add deliverables here shortly.</p></div>';
  container.innerHTML = html;
  // Now populate each job's review items
  jobs.forEach(function(job) {
    const hasManual = job.review_items && job.review_items.length > 0;
    const folders = (job.files || []).filter(function(f){ return f.access_level === 'review_folder'; });
    if (hasManual) {
      renderJobReviewItems(job.id, job.review_items, []);
    } else if (folders.length) {
      loadJobDriveReviewItems(job.id, folders);
    }
  });
}

function renderJobReviewItems(jobId, items, categories) {
  jobReviewItems[jobId] = items;
  jobCategories[jobId] = categories || [];
  jobActiveCats[jobId] = 0;
  const saved = JSON.parse(localStorage.getItem('lbmd_review_' + CLIENT_ID + '_job_' + jobId) || '{}');
  jobRatings[jobId] = saved;
  const list = document.getElementById('review-list-' + jobId);
  if (!list) return;
  if (!items.length) {
    list.innerHTML = '<div class="review-empty"><h3>No deliverables yet.</h3><p>Your producer will configure review items here shortly.</p></div>';
    return;
  }
  document.getElementById('submit-area-' + jobId).classList.remove('hidden');
  document.getElementById('prog-total-' + jobId).textContent = items.length;
  if (categories && categories.length > 0) {
    const catsEl = document.getElementById('review-cats-' + jobId);
    if (catsEl) {
      if (categories.length > 1) {
        catsEl.classList.remove('hidden');
        catsEl.innerHTML = categories.map(function(cat, i){
          const rated = cat.items.filter(function(item){ return saved[item.id]; }).length;
          return '<button class="review-cat-btn ' + (i===0?'active':'') + '" onclick="switchJobCat(' + jobId + ',' + i + ')">' + cat.label + '<span class="cat-badge">' + rated + '/' + cat.items.length + '</span></button>';
        }).join('');
      } else {
        catsEl.classList.add('hidden');
      }
    }
    // Render only the first category's items initially
    renderJobItemList(jobId, categories[0].items);
  } else {
    renderJobItemList(jobId, items);
  }
  updateJobProgress(jobId);
}

function renderJobItemList(jobId, items) {
  const list = document.getElementById('review-list-' + jobId);
  if (!list) return;
  const saved = jobRatings[jobId] || {};
  list.innerHTML = items.map(function(item) {
    return '<div class="review-item ' + (saved[item.id]?'rated':'') + '" id="ri-' + jobId + '-' + item.id + '">'
      + (item.thumbnail ? '<div class="review-thumb"><img src="' + item.thumbnail + '" alt="' + item.label + '" loading="lazy" onerror="this.parentElement.style.display=\\'none\\'"></div>' : '')
      + '<div class="review-item-header">'
      + (item.url ? '<a class="review-item-label" href="' + item.url + '" target="_blank" rel="noopener" style="color:var(--gold)">' + item.label + '</a>' : '<span class="review-item-label">' + item.label + '</span>')
      + '<span class="review-item-type">' + (item.type||'General') + '</span></div>'
      + (item.description ? '<p style="font-size:12px;color:var(--silver);margin-bottom:12px">' + item.description + '</p>' : '')
      + '<div class="rating-btns">'
      + '<button class="rating-btn ' + (saved[item.id]==='love'?'active-love':'') + '" data-job="' + jobId + '" data-id="' + item.id + '" data-rating="love">❤️ Love It</button>'
      + '<button class="rating-btn ' + (saved[item.id]==='maybe'?'active-maybe':'') + '" data-job="' + jobId + '" data-id="' + item.id + '" data-rating="maybe">💭 Maybe</button>'
      + '<button class="rating-btn ' + (saved[item.id]==='pass'?'active-pass':'') + '" data-job="' + jobId + '" data-id="' + item.id + '" data-rating="pass">✗ Pass</button>'
      + '</div>'
      + '<textarea class="review-note-input" placeholder="Add a note (optional)..." id="note-' + jobId + '-' + item.id + '">' + (saved['note_'+item.id]||'') + '</textarea>'
      + '</div>';
  }).join('');
  // Wire up rating buttons
  list.querySelectorAll('.rating-btn').forEach(function(btn) {
    btn.onclick = function() {
      const jid = this.dataset.job;
      const id = this.dataset.id;
      const rating = this.dataset.rating;
      if (!jobRatings[jid]) jobRatings[jid] = {};
      jobRatings[jid][id] = rating;
      const noteEl = document.getElementById('note-' + jid + '-' + id);
      if (noteEl) jobRatings[jid]['note_'+id] = noteEl.value;
      localStorage.setItem('lbmd_review_' + CLIENT_ID + '_job_' + jid, JSON.stringify(jobRatings[jid]));
      const ri = document.getElementById('ri-' + jid + '-' + id);
      if (ri) { ri.classList.add('rated'); ri.querySelectorAll('.rating-btn').forEach(function(b){ b.className='rating-btn'; }); }
      const cls = {love:'active-love',maybe:'active-maybe',pass:'active-pass'}[rating];
      this.classList.add(cls);
      updateJobProgress(jid);
      // Update cat badge if categories exist
      const activeCatIdx = jobActiveCats[jid] !== undefined ? jobActiveCats[jid] : 0;
      const cats = jobCategories[jid] || [];
      if (cats.length > 1) {
        const catsEl = document.getElementById('review-cats-' + jid);
        if (catsEl) {
          const buttons = catsEl.querySelectorAll('.review-cat-btn');
          cats.forEach(function(cat, ci) {
            const r = jobRatings[jid] || {};
            const rated = cat.items.filter(function(it){ return r[it.id]; }).length;
            const badge = buttons[ci] ? buttons[ci].querySelector('.cat-badge') : null;
            if (badge) badge.textContent = rated + '/' + cat.items.length;
          });
        }
      }
    };
  });
  list.querySelectorAll('.review-note-input').forEach(function(ta) {
    ta.oninput = function() {
      const parts = this.id.split('-');
      const jid = parts[1]; const id = parts[2];
      if (!jobRatings[jid]) jobRatings[jid] = {};
      jobRatings[jid]['note_'+id] = this.value;
      localStorage.setItem('lbmd_review_' + CLIENT_ID + '_job_' + jid, JSON.stringify(jobRatings[jid]));
    };
  });
}

function switchJobCat(jobId, idx) {
  jobActiveCats[jobId] = idx;
  // Update active tab button
  const catsEl = document.getElementById('review-cats-' + jobId);
  if (catsEl) {
    catsEl.querySelectorAll('.review-cat-btn').forEach(function(b, i) {
      b.classList.toggle('active', i === idx);
    });
  }
  // Render the selected category's items
  const cats = jobCategories[jobId] || [];
  if (cats[idx]) renderJobItemList(jobId, cats[idx].items);
}

function updateJobProgress(jobId) {
  const items = jobReviewItems[jobId] || [];
  const r = jobRatings[jobId] || {};
  const rated = items.filter(function(i){ return r[i.id]; }).length;
  const total = items.length;
  const pct = total ? (rated/total)*100 : 0;
  const fill = document.getElementById('prog-fill-' + jobId);
  const cnt = document.getElementById('prog-count-' + jobId);
  if (fill) fill.style.width = pct + '%';
  if (cnt) cnt.textContent = rated;
  const warn = document.getElementById('unrated-warn-' + jobId);
  if (warn) {
    const unrated = total - rated;
    if (unrated > 0) { warn.textContent = '⚠ ' + unrated + ' item(s) unrated — you can still submit.'; warn.classList.remove('hidden'); }
    else { warn.classList.add('hidden'); }
  }
}

async function loadJobDriveReviewItems(jobId, folderCards) {
  const url = '${REVIEW_SCRIPT_URL}';
  if (!url || url.includes('PASTE_YOUR')) return;
  const list = document.getElementById('review-list-' + jobId);
  function setLoading(msg) {
    if (list) list.innerHTML = '<div class="drive-loading">' + msg + '</div>';
  }
  setLoading('⟳ Connecting to Drive…');
  const categories = [];
  for (var i = 0; i < folderCards.length; i++) {
    const card = folderCards[i];
    const m = card.drive_url ? card.drive_url.match(/\\/folders\\/([a-zA-Z0-9_-]+)/) : null;
    if (!m) continue;
    try {
      // Step 1: fetch the top-level review folder
      setLoading('⟳ Loading ' + card.label + '…');
      const res = await fetch(url + '?action=listFolder&folderId=' + m[1]);
      const d = await res.json();
      if (d.status === 'success' && d.files) {
        // Items without a type are subfolders; items with a type are files
        const subfolders = d.files.filter(function(f){ return !f.type; });
        const directFiles = d.files.filter(function(f){ return f.type; });
        if (subfolders.length > 0) {
          // Step 2a: subfolders found — each subfolder becomes a category tab
          for (var j = 0; j < subfolders.length; j++) {
            const sub = subfolders[j];
            setLoading('⟳ Loading <strong>' + sub.name + '</strong>… (' + (j + 1) + '/' + subfolders.length + ')');
            try {
              const subRes = await fetch(url + '?action=listFolder&folderId=' + sub.id);
              const subD = await subRes.json();
              if (subD.status === 'success' && subD.files) {
                const subItems = subD.files.filter(function(f){ return f.type; }).map(function(f){
                  return { id: f.id, label: f.name, type: f.type, description: '', thumbnail: f.thumbnail||'', url: f.url, _fromDrive: true };
                });
                if (subItems.length) categories.push({ label: sub.name, items: subItems });
              }
            } catch(e) { console.error('Subfolder fetch error', sub.name, e); }
          }
        } else if (directFiles.length > 0) {
          // Step 2b: no subfolders — files are directly in the folder, use card label as category
          const items = directFiles.map(function(f){
            return { id: f.id, label: f.name, type: f.type, description: '', thumbnail: f.thumbnail||'', url: f.url, _fromDrive: true };
          });
          categories.push({ label: card.label, items: items });
        }
      }
    } catch(e) { console.error('Drive fetch error', e); }
  }
  if (!categories.length) { if (list) list.innerHTML = '<div class="review-empty"><h3>No deliverables found.</h3><p>Check your Drive folder links.</p></div>'; return; }
  const allItems = categories.reduce(function(acc, c){ return acc.concat(c.items); }, []);
  renderJobReviewItems(jobId, allItems, categories);
}

async function submitJobReview(jobId) {
  const btn = document.getElementById('submit-btn-' + jobId);
  const errEl = document.getElementById('submit-error-' + jobId);
  const succEl = document.getElementById('submit-success-' + jobId);
  if (errEl) errEl.classList.add('hidden');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
  const token = getToken();
  if (!token) {
    if (btn) { btn.disabled = false; btn.textContent = 'Send My Review to LBMD →'; }
    if (errEl) { errEl.textContent = '⚠ Session expired. Please log out and back in.'; errEl.classList.remove('hidden'); }
    return;
  }
  const items = jobReviewItems[jobId] || [];
  const r = jobRatings[jobId] || {};
  const payload = items.map(function(item) { return { itemId: String(item.id), label: item.label, rating: r[item.id]||'unrated', note: r['note_'+item.id]||'' }; });
  try {
    const res = await fetch(API + '/api/review/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ clientId: CLIENT_ID, jobId: jobId, responses: payload })
    });
    const data = await res.json();
    if (data.success) {
      if (btn) btn.style.display = 'none';
      if (succEl) succEl.classList.remove('hidden');
      // Notify via Apps Script
      const scriptUrl = '${REVIEW_SCRIPT_URL}';
      if (scriptUrl && !scriptUrl.includes('PASTE_YOUR') && clientPortalData) {
        try {
          const jobObj = (clientPortalData.jobs||[]).find(function(j){ return String(j.id)===String(jobId); });
          await fetch(scriptUrl, { method:'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({ type:'review_submitted', clientName: clientPortalData.name, projectTitle: clientPortalData.event||clientPortalData.name, projectId: CLIENT_ID, jobTitle: jobObj ? jobObj.title : 'Unknown', items: items.map(function(i){ return { id:String(i.id), title:i.label, type:i.type||'General' }; }), review: items.reduce(function(acc,i){ acc[String(i.id)]={rating:r[i.id]||'unrated',note:r['note_'+i.id]||''}; return acc; }, {}) }) });
        } catch(e) {}
      }
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Send My Review to LBMD →'; }
      if (errEl) { errEl.textContent = '⚠ ' + (data.error||'Submission failed. Please try again.'); errEl.classList.remove('hidden'); }
    }
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Send My Review to LBMD →'; }
    if (errEl) { errEl.textContent = '⚠ Connection error. Please try again.'; errEl.classList.remove('hidden'); }
  }
}

// ── LEGACY FLAT PORTAL RENDERING (clients with no jobs) ──
function renderLegacyDashboard(files) {
  const container = document.getElementById('portal-dashboard-content');
  files = files.filter(function(f){ return f.access_level !== 'review_folder'; });
  if (!files.length) { container.innerHTML = '<p style="color:#555;font-size:13px;padding:20px 0">No files available yet.</p>'; return; }
  container.innerHTML = '<div class="section-eyebrow">Access Your Files</div><div class="files-grid">' + files.map(function(f){
    return '<a class="file-card ' + (f.access_level==='locked'?'locked':'') + '" href="' + f.drive_url + '" target="_blank" rel="noopener">'
      + '<div class="file-icon">' + (f.icon||'📁') + '</div><div class="file-label">' + f.label + '</div>'
      + (f.subtitle?'<div class="file-subtitle">'+f.subtitle+'</div>':'')
      + (f.description?'<div class="file-desc">'+f.description+'</div>':'')
      + '<div class="file-arrow">→</div></a>';
  }).join('') + '</div>';
}

function renderLegacyReview(items, files) {
  const container = document.getElementById('portal-review-content');
  container.innerHTML = '<div class="review-progress-bar" style="margin-bottom:4px"><div class="review-progress-fill" id="legacy-prog-fill" style="width:0%"></div></div>'
    + '<div class="progress-label" style="margin-bottom:16px"><span id="legacy-prog-count">0</span> / <span id="legacy-prog-total">0</span> rated</div>'
    + '<div class="review-cats hidden" id="review-cats"></div>'
    + '<div class="review-items-list" id="review-items-list"><div class="review-empty"><h3>No items yet.</h3><p>Your producer will add deliverables here shortly.</p></div></div>'
    + '<div class="submit-area hidden" id="submit-area">'
    + '<p>When you\\'re done rating, click below to send your review to your producer.</p>'
    + '<div class="unrated-warn hidden" id="unrated-warn"></div>'
    + '<button class="submit-btn" id="submit-btn" onclick="submitLegacyReview()">Send My Review to LBMD →</button>'
    + '<div class="submit-success hidden" id="submit-success">✓ Review submitted! Your producer will be in touch shortly.</div>'
    + '<div class="submit-error hidden" id="submit-error"></div>'
    + '</div>';
  renderReviewItems(items);
  loadDriveReviewItems(files, items);
}

async function loadDriveReviewItems(fileCards, manualItems) {
  const url = '${REVIEW_SCRIPT_URL}';
  const catCards = fileCards.filter(f => f.access_level === 'review_folder');
  if (!catCards.length || !url || url.includes('PASTE_YOUR')) return;
  const list = document.getElementById('review-items-list');
  list.innerHTML = '<div class="drive-loading">⟳ Connecting to Drive…</div>';
  reviewCategories = [];
  for (const card of catCards) {
    const m = card.drive_url ? card.drive_url.match(/\\/folders\\/([a-zA-Z0-9_-]+)/) : null;
    if (!m) continue;
    try {
      // Step 1: fetch top-level review folder
      list.innerHTML = '<div class="drive-loading">⟳ Loading ' + card.label + '…</div>';
      const res = await fetch(url + '?action=listFolder&folderId=' + m[1]);
      const d = await res.json();
      if (d.status === 'success' && d.files) {
        const subfolders = d.files.filter(f => !f.type);
        const directFiles = d.files.filter(f => f.type);
        if (subfolders.length > 0) {
          // Step 2a: subfolders found — each subfolder is a category tab
          for (let j = 0; j < subfolders.length; j++) {
            const sub = subfolders[j];
            list.innerHTML = '<div class="drive-loading">⟳ Loading <strong>' + sub.name + '</strong>… (' + (j + 1) + '/' + subfolders.length + ')</div>';
            try {
              const subRes = await fetch(url + '?action=listFolder&folderId=' + sub.id);
              const subD = await subRes.json();
              if (subD.status === 'success' && subD.files) {
                const subItems = subD.files
                  .filter(f => f.type)
                  .map(f => ({ id: f.id, label: f.name, type: f.type, description: '', thumbnail: f.thumbnail || '', url: f.url, _fromDrive: true }));
                if (subItems.length) reviewCategories.push({ label: sub.name, items: subItems });
              }
            } catch(e) { console.error('Subfolder fetch error', sub.name, e); }
          }
        } else if (directFiles.length > 0) {
          // Step 2b: no subfolders — use files directly under the card label
          const items = directFiles.map(f => ({ id: f.id, label: f.name, type: f.type, description: '', thumbnail: f.thumbnail || '', url: f.url, _fromDrive: true }));
          if (items.length) reviewCategories.push({ label: card.label, items });
        }
      }
    } catch(e) { console.error('Drive fetch error', e); }
  }
  if (!reviewCategories.length) return;
  reviewItems = reviewCategories.flatMap(c => c.items);
  activeCatIndex = 0;
  renderReviewCategoryTabs();
  renderReviewItems(reviewCategories[0].items);
}

function renderReviewCategoryTabs() {
  const catsEl = document.getElementById('review-cats');
  if (reviewCategories.length <= 1) { catsEl.classList.add('hidden'); return; }
  catsEl.classList.remove('hidden');
  catsEl.innerHTML = reviewCategories.map((cat, i) => {
    const rated = cat.items.filter(item => ratings[item.id]).length;
    return \`<button class="review-cat-btn \${i===activeCatIndex?'active':''}" onclick="switchReviewCat(\${i})">\${cat.label}<span class="cat-badge">\${rated}/\${cat.items.length}</span></button>\`;
  }).join('');
}

function switchReviewCat(idx) {
  activeCatIndex = idx;
  renderReviewCategoryTabs();
  renderReviewItems(reviewCategories[idx].items);
}

function renderPhase(phase) {
  const badge = document.getElementById('phase-badge');
  const label = document.getElementById('phase-label');
  badge.className = 'phase-badge ' + phase;
  const map = {in_progress:'In Progress',in_review:'In Review',complete:'Complete'};
  label.textContent = map[phase] || phase;
}

function renderFiles(files) {
  const grid = document.getElementById('files-grid');
  files = files.filter(f => f.access_level !== 'review_folder');
  if (!files.length) { grid.innerHTML = '<p style="color:#555;font-size:13px;padding:20px 0">No files available yet.</p>'; return; }
  grid.innerHTML = files.map(f => \`
    <a class="file-card \${f.access_level==='locked'?'locked':''}" href="\${f.drive_url}" target="_blank" rel="noopener">
      <div class="file-icon">\${f.icon||'📁'}</div>
      <div class="file-label">\${f.label}</div>
      \${f.subtitle?\`<div class="file-subtitle">\${f.subtitle}</div>\`:''}
      \${f.description?\`<div class="file-desc">\${f.description}</div>\`:''}
      <div class="file-arrow">→</div>
    </a>\`).join('');
}

function renderNote(note) {
  const el = document.getElementById('admin-note-text');
  if (note && note.trim()) { el.textContent = note; el.classList.remove('note-empty'); }
  else { el.textContent = 'No notes from your producer yet.'; el.classList.add('note-empty'); }
}

function renderStatus(phase) {
  const phases = [
    {key:'booked',label:'Project Booked',done:true},
    {key:'onboarding',label:'Onboarding Complete',done:true},
    {key:'production',label:'Production Wrapped',done:true},
    {key:'in_review',label:'Files In Review',done:phase==='in_review'||phase==='complete'},
    {key:'complete',label:'Final Delivery',done:phase==='complete'}
  ];
  document.getElementById('status-list').innerHTML = phases.map(p => \`
    <li class="status-item">
      <span class="status-dot \${p.done?'done':(phase==='in_review'&&p.key==='in_review'?'active':'pending')}"></span>
      <span>\${p.label}</span>
    </li>\`).join('');
}

function renderReviewItems(items) {
  if (!reviewCategories.length) reviewItems = items;
  const list = document.getElementById('review-items-list');
  if (!items.length) {
    list.innerHTML = '<div class="review-empty"><h3>No deliverables yet.</h3><p>Your producer will configure review items here shortly.</p></div>';
    document.getElementById('submit-area').classList.add('hidden');
    return;
  }
  document.getElementById('submit-area').classList.remove('hidden');
  document.getElementById('review-total-count').textContent = reviewItems.length;
  // load saved progress
  const saved = JSON.parse(localStorage.getItem('lbmd_review_' + CLIENT_ID) || '{}');
  ratings = saved;
  list.innerHTML = items.map(item => \`
    <div class="review-item \${saved[item.id]?'rated':''}" id="ri-\${item.id}">
      \${item.thumbnail?\`<div class="review-thumb"><img src="\${item.thumbnail}" alt="\${item.label}" loading="lazy" onerror="this.parentElement.style.display='none'"></div>\`:''}
      <div class="review-item-header">
        \${item.url?\`<a class="review-item-label" href="\${item.url}" target="_blank" rel="noopener" style="color:var(--gold)">\${item.label}</a>\`:\`<span class="review-item-label">\${item.label}</span>\`}
        <span class="review-item-type">\${item.type||'General'}</span>
      </div>
      \${item.description?\`<p style="font-size:12px;color:var(--silver);margin-bottom:12px">\${item.description}</p>\`:''}
      <div class="rating-btns">
        <button class="rating-btn \${saved[item.id]==='love'?'active-love':''}" data-id="\${item.id}" data-rating="love">❤️ Love It</button>
        <button class="rating-btn \${saved[item.id]==='maybe'?'active-maybe':''}" data-id="\${item.id}" data-rating="maybe">💭 Maybe</button>
        <button class="rating-btn \${saved[item.id]==='pass'?'active-pass':''}" data-id="\${item.id}" data-rating="pass">✗ Pass</button>
      </div>
      <textarea class="review-note-input" placeholder="Add a note (optional)..." id="note-\${item.id}">\${saved['note_'+item.id]||''}</textarea>
    </div>\`).join('');
  updateProgress();
  // click handlers
  list.querySelectorAll('.rating-btn').forEach(btn => {
    btn.onclick = function() {
      const id = this.dataset.id;
      const rating = this.dataset.rating;
      ratings[id] = rating;
      const note = document.getElementById('note-'+id).value;
      ratings['note_'+id] = note;
      localStorage.setItem('lbmd_review_' + CLIENT_ID, JSON.stringify(ratings));
      // update UI
      const ri = document.getElementById('ri-'+id);
      ri.classList.add('rated');
      ri.querySelectorAll('.rating-btn').forEach(b => b.className = 'rating-btn');
      const cls = {love:'active-love',maybe:'active-maybe',pass:'active-pass'}[rating];
      this.classList.add(cls);
      updateProgress();
      if (reviewCategories.length > 1) renderReviewCategoryTabs();
    };
  });
  list.querySelectorAll('.review-note-input').forEach(ta => {
    ta.oninput = function() {
      const id = this.id.replace('note-','');
      ratings['note_'+id] = this.value;
      localStorage.setItem('lbmd_review_' + CLIENT_ID, JSON.stringify(ratings));
    };
  });
}

function updateProgress() {
  const rated = reviewItems.filter(i => ratings[i.id]).length;
  const total = reviewItems.length;
  const pct = total ? (rated/total)*100 : 0;
  document.getElementById('review-progress-fill').style.width = pct + '%';
  document.getElementById('review-progress-count').textContent = rated;
  const unrated = total - rated;
  if (unrated > 0) {
    document.getElementById('unrated-warn').textContent = '⚠ ' + unrated + ' item(s) unrated — you can still submit.';
    document.getElementById('unrated-warn').classList.remove('hidden');
  } else {
    document.getElementById('unrated-warn').classList.add('hidden');
  }
}

// ── SUBMIT REVIEW (legacy — no jobs) ──
function showSubmitError(msg) {
  const el = document.getElementById('submit-error');
  if (el) { el.textContent = '⚠ ' + msg; el.classList.remove('hidden'); }
}
async function submitLegacyReview() {
  const btn = document.getElementById('submit-btn');
  const errEl = document.getElementById('submit-error');
  if (errEl) errEl.classList.add('hidden');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
  const token = getToken();
  if (!token) {
    if (btn) { btn.disabled = false; btn.textContent = 'Send My Review to LBMD →'; }
    showSubmitError('Session expired. Please log out and back in, then try again.');
    return;
  }
  const payload = reviewItems.map(item => ({
    itemId: String(item.id),
    label: item.label,
    rating: ratings[item.id] || 'unrated',
    note: ratings['note_'+item.id] || ''
  }));
  try {
    const res = await fetch(API + '/api/review/submit', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({ clientId: CLIENT_ID, responses: payload })
    });
    let data;
    try { data = await res.json(); } catch(je) { data = {}; }
    if (data.success) {
      const succ = document.getElementById('submit-success');
      if (succ) succ.classList.remove('hidden');
      if (btn) btn.classList.add('hidden');
      const desc = document.getElementById('submit-desc');
      if (desc) desc.classList.add('hidden');
      const warn = document.getElementById('unrated-warn');
      if (warn) warn.classList.add('hidden');
      // Fire Apps Script email + sheet log
      const scriptUrl = '${REVIEW_SCRIPT_URL}';
      if (scriptUrl && !scriptUrl.includes('PASTE_YOUR')) {
        try {
          const scriptPayload = {
            clientName:   clientPortalData ? clientPortalData.name  : CLIENT_ID,
            projectTitle: clientPortalData ? (clientPortalData.event || clientPortalData.name) : CLIENT_ID,
            projectId:    CLIENT_ID,
            items: reviewItems.map(i => ({
              id:       String(i.id),
              title:    i.label,
              type:     i.type || 'General',
              subtitle: i.description || ''
            })),
            review: Object.fromEntries(reviewItems.map(i => [
              String(i.id),
              { rating: ratings[i.id] || 'unrated', note: ratings['note_'+i.id] || '' }
            ]))
          };
          fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(scriptPayload)
          }).catch(() => {});
        } catch(e) {}
      }
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Send My Review to LBMD →'; }
      const errMsg = data.error || ('Server returned ' + res.status);
      console.error('Review submit failed:', errMsg, data);
      showSubmitError(errMsg);
    }
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Send My Review to LBMD →'; }
    console.error('Review submit error:', e);
    showSubmitError('Connection error — please check your internet and try again.');
  }
}

// ── TABS ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = function() {
    const tab = this.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('tab-'+tab).classList.add('active');
  };
});

// ── LOGOUT ──
document.getElementById('logout-btn').onclick = function() {
  clearToken();
  window.location.reload();
};

// ── AUTO-LOGIN ──
(async function init() {
  const existing = getToken();
  if (existing) {
    try {
      const res = await fetch(API + '/api/portal/' + CLIENT_ID, {
        headers: {'Authorization':'Bearer '+existing}
      });
      if (res.ok) {
        const data = await res.json();
        loadPortal(data);
        return;
      }
    } catch(e) {}
    clearToken();
  }
})();
</script>
</body>
</html>`;

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LBMD Admin Portal</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--black:#080808;--charcoal:#111111;--navy:#0D1B33;--gold:#B8962E;--gold-l:#D4AF5A;--silver:#999;--white:#fff;--green:#27AE60;--amber:#E67E22;--red:#C0392B;--border:#1e1e1e}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--black);color:var(--white);font-family:'Montserrat',sans-serif;font-size:13px;min-height:100vh}
button{cursor:pointer;font-family:'Montserrat',sans-serif}
.hidden{display:none!important}
input,textarea,select{font-family:'Montserrat',sans-serif}

/* LOGIN */
#admin-login{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--black);padding:20px}
.acard{background:var(--charcoal);border:1px solid var(--border);border-radius:12px;overflow:hidden;width:100%;max-width:380px}
.acard-logo{background:var(--navy);padding:28px;text-align:center}
.acard-logo img{width:64px}
.acard-body{padding:32px 28px}
.acard-body h2{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:400;margin-bottom:4px}
.acard-body p{color:var(--silver);font-size:12px;margin-bottom:24px}
.fl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--silver);margin-bottom:5px;display:block}
.fi{width:100%;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;padding:11px 13px;color:var(--white);font-size:13px;outline:none;transition:border .2s;margin-bottom:14px}
.fi:focus{border-color:var(--gold)}
.abtn{width:100%;background:var(--gold);color:var(--black);border:none;border-radius:6px;padding:12px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;transition:background .2s}
.abtn:hover{background:var(--gold-l)}
.aerr{color:var(--red);font-size:12px;margin-top:8px;min-height:16px}
.a-forgot-link{display:block;text-align:center;margin-top:14px;font-size:11px;color:var(--silver);letter-spacing:.5px;cursor:pointer;transition:color .2s}
.a-forgot-link:hover{color:var(--gold)}
.asucc{color:var(--green);font-size:12px;margin-top:8px;min-height:16px}

/* LAYOUT */
#admin-app{display:flex;flex-direction:column;min-height:100vh}
.admin-topbar{background:var(--charcoal);border-bottom:1px solid var(--border);padding:0 24px;height:52px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.topbar-left{display:flex;align-items:center;gap:12px}
.topbar-logo{height:28px}
.topbar-title{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--silver)}
.topbar-badge{background:rgba(184,150,46,.15);color:var(--gold);border:1px solid rgba(184,150,46,.3);border-radius:3px;font-size:10px;letter-spacing:1px;padding:2px 8px}
.topbar-logout{background:none;border:1px solid #2a2a2a;color:var(--silver);padding:5px 12px;border-radius:4px;font-size:11px;transition:all .2s}
.topbar-logout:hover{border-color:var(--gold);color:var(--gold)}

.admin-body{display:flex;flex:1}
.admin-sidebar{width:200px;background:#0c0c0c;border-right:1px solid var(--border);padding:20px 0;flex-shrink:0}
.sidebar-section{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#444;padding:12px 20px 4px}
.sidebar-link{display:flex;align-items:center;gap:8px;padding:9px 20px;color:var(--silver);font-size:12px;cursor:pointer;transition:all .2s;border:none;background:none;width:100%;text-align:left;border-left:2px solid transparent}
.sidebar-link:hover{color:var(--white);background:rgba(255,255,255,.03)}
.sidebar-link.active{color:var(--gold);background:rgba(184,150,46,.07);border-left-color:var(--gold)}
.sidebar-link .icon{width:16px;text-align:center}

.admin-main{flex:1;overflow-y:auto;padding:28px 32px}
@media(max-width:768px){
  .admin-sidebar{display:none}
  .admin-main{padding:20px 16px}
}

/* PAGE HEADERS */
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px}
.page-title{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:400}
.page-sub{color:var(--silver);font-size:12px;margin-top:2px}

/* BUTTONS */
.btn{border:none;border-radius:5px;padding:9px 18px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;transition:all .2s;cursor:pointer}
.btn-gold{background:var(--gold);color:var(--black)}
.btn-gold:hover{background:var(--gold-l)}
.btn-outline{background:transparent;border:1px solid #2a2a2a;color:var(--silver)}
.btn-outline:hover{border-color:var(--gold);color:var(--gold)}
.btn-danger{background:transparent;border:1px solid #3a1515;color:var(--red)}
.btn-danger:hover{background:rgba(192,57,43,.1)}
.btn-sm{padding:5px 12px;font-size:10px}

/* CLIENT CARDS */
.client-card{background:var(--charcoal);border:1px solid var(--border);border-radius:8px;padding:18px 20px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.client-info{}
.client-name{font-size:15px;font-weight:600;color:var(--white);margin-bottom:4px}
.client-meta{font-size:11px;color:var(--silver);display:flex;gap:12px;flex-wrap:wrap}
.client-actions{display:flex;gap:8px;flex-shrink:0}
.status-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase}
.pill-active{background:rgba(39,174,96,.12);color:var(--green);border:1px solid rgba(39,174,96,.3)}
.pill-in_review{background:rgba(184,150,46,.12);color:var(--gold);border:1px solid rgba(184,150,46,.3)}
.pill-closed{background:rgba(192,57,43,.1);color:var(--red);border:1px solid rgba(192,57,43,.2)}
.pill-archived{background:rgba(153,153,153,.1);color:var(--silver);border:1px solid #2a2a2a}

/* TABS */
.tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:24px}
.tab{background:none;border:none;border-bottom:2px solid transparent;padding:11px 18px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--silver);transition:all .2s;cursor:pointer}
.tab.active{color:var(--gold);border-bottom-color:var(--gold)}
.tab:hover:not(.active){color:var(--white)}

/* FORM */
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.form-grid.full{grid-template-columns:1fr}
.form-group{display:flex;flex-direction:column;gap:5px}
.form-group.span2{grid-column:1/-1}
.flabel{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--silver)}
.fhint{font-size:11px;color:#555;margin-top:2px}
.finput,.fselect,.ftextarea{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:5px;padding:10px 12px;color:var(--white);font-size:13px;outline:none;transition:border .2s;width:100%}
.finput:focus,.fselect:focus,.ftextarea:focus{border-color:var(--gold)}
.fselect{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
.ftextarea{min-height:80px;resize:vertical}
.form-actions{margin-top:20px;display:flex;gap:10px;flex-wrap:wrap}

/* FILE ROW */
.file-row{background:#0d0d0d;border:1px solid var(--border);border-radius:6px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.file-row-icon{font-size:20px;flex-shrink:0}
.file-row-info{flex:1;min-width:0}
.file-row-label{font-size:13px;font-weight:600;color:var(--white)}
.file-row-url{font-size:11px;color:var(--silver);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px}
.file-row-actions{display:flex;gap:6px;flex-shrink:0}

/* REVIEW ROW */
.review-row{background:#0d0d0d;border:1px solid var(--border);border-radius:6px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.review-row-info{flex:1}
.review-row-label{font-size:13px;font-weight:600;color:var(--white)}
.review-row-type{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--silver);background:#1a1a1a;padding:2px 8px;border-radius:3px}
.review-row-actions{display:flex;gap:6px}

/* SUBMITTED REVIEW */
.submitted-header{background:rgba(39,174,96,.06);border:1px solid rgba(39,174,96,.2);border-radius:8px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:10px}
.submitted-header span{color:var(--green);font-size:13px}
.rating-row{background:#0d0d0d;border:1px solid var(--border);border-radius:6px;padding:14px 16px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
.rating-label{flex:1;font-size:13px;color:var(--white)}
.rating-pill{padding:3px 12px;border-radius:4px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;flex-shrink:0}
.rating-love{background:rgba(39,174,96,.15);color:var(--green)}
.rating-maybe{background:rgba(184,150,46,.15);color:var(--gold)}
.rating-pass{background:rgba(192,57,43,.15);color:var(--red)}
.rating-unrated{background:#1a1a1a;color:#555}
.rating-note{font-size:11px;color:var(--silver);margin-top:6px;font-style:italic;width:100%}

/* MODAL */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:var(--charcoal);border:1px solid var(--border);border-radius:10px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;padding:28px}
.modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.modal-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400}
.modal-close{background:none;border:none;color:var(--silver);font-size:20px;cursor:pointer;padding:4px}
.modal-close:hover{color:var(--white)}

/* MISC */
.divider{border:none;border-top:1px solid var(--border);margin:20px 0}
.empty-state{text-align:center;padding:48px 20px;color:var(--silver)}
.empty-state h3{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;margin-bottom:8px;color:var(--white)}
.info-box{background:rgba(184,150,46,.05);border:1px solid rgba(184,150,46,.15);border-radius:6px;padding:12px 16px;font-size:12px;color:var(--silver);margin-bottom:16px}
.portal-url{font-family:monospace;font-size:12px;color:var(--gold-l);background:#1a1a1a;padding:8px 12px;border-radius:4px;display:inline-block;margin-top:6px}
.msg{padding:10px 14px;border-radius:5px;font-size:12px;margin-bottom:14px}
.msg-success{background:rgba(39,174,96,.1);border:1px solid rgba(39,174,96,.3);color:var(--green)}
.msg-error{background:rgba(192,57,43,.1);border:1px solid rgba(192,57,43,.3);color:var(--red)}
</style>
</head>
<body>

<!-- ADMIN LOGIN -->
<div id="admin-login">
  <div class="acard">
    <div class="acard-logo"><img src="data:image/png;base64,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" alt="LBM"></div>
    <div class="acard-body">
      <div id="a-login-main">
        <h2>Admin Portal</h2>
        <p>Lucky Black Media &amp; Design</p>
        <label class="fl">Admin Password</label>
        <input class="fi" id="a-pw" type="password" placeholder="Enter admin password" autocomplete="current-password">
        <button class="abtn" id="a-login-btn">ACCESS ADMIN →</button>
        <div class="aerr" id="a-err"></div>
        <span class="a-forgot-link" onclick="showAdminForgot()">Forgot password?</span>
      </div>
      <div id="a-reset-1" style="display:none">
        <h2>Reset Password</h2>
        <p>A 6-digit code will be sent to both admin email addresses on file.</p>
        <button class="abtn" id="a-reset-send-btn" onclick="submitAdminResetRequest()">SEND RESET CODE</button>
        <div class="aerr" id="a-reset-err-1"></div>
        <span class="a-forgot-link" onclick="showAdminLogin()">← Back to login</span>
      </div>
      <div id="a-reset-2" style="display:none">
        <h2>Set New Password</h2>
        <p>Enter the 6-digit code from your email and choose a new password.</p>
        <label class="fl">6-Digit Code</label>
        <input class="fi" id="a-reset-otp" type="text" inputmode="numeric" maxlength="6" placeholder="000000">
        <label class="fl">New Password</label>
        <input class="fi" id="a-reset-newpw" type="password" placeholder="Enter new admin password">
        <button class="abtn" id="a-reset-verify-btn" onclick="submitAdminResetVerify()">SET NEW PASSWORD</button>
        <div class="aerr" id="a-reset-err-2"></div>
        <span class="a-forgot-link" onclick="showAdminForgot()">← Back</span>
      </div>
    </div>
  </div>
</div>

<!-- ADMIN APP -->
<div id="admin-app" class="hidden">
  <div class="admin-topbar">
    <div class="topbar-left">
      <img class="topbar-logo" src="data:image/png;base64,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" alt="LBM">
      <span class="topbar-title">Admin Portal</span>
      <span class="topbar-badge">LBMD Internal</span>
    </div>
    <button class="topbar-logout" id="a-logout">Log Out</button>
  </div>
  <div class="admin-body">
    <div class="admin-sidebar">
      <div class="sidebar-section">Clients</div>
      <button class="sidebar-link active" data-view="clients" onclick="showView('clients')"><span class="icon">◈</span> All Clients</button>
      <button class="sidebar-link" data-view="new-client" onclick="showView('new-client')"><span class="icon">+</span> New Client</button>
      <div class="sidebar-section">System</div>
      <button class="sidebar-link" data-view="settings" onclick="showView('settings')"><span class="icon">⚙</span> Settings</button>
    </div>
    <div class="admin-main" id="admin-main">
      <!-- dynamic content -->
    </div>
  </div>
</div>

<!-- MODALS -->
<div id="modal-overlay" class="modal-overlay hidden" onclick="if(event.target===this)closeModal()">
  <div class="modal" id="modal-content"></div>
</div>

<script>
const AAPI = '';
let adminToken = null;
let currentClients = [];
let currentClientId = null;
let currentJobId = null;

function getAdminToken(){ return adminToken || localStorage.getItem('lbmd_admin_token'); }
function setAdminToken(t){ adminToken = t; localStorage.setItem('lbmd_admin_token', t); }
function clearAdminToken(){ adminToken = null; localStorage.removeItem('lbmd_admin_token'); }

// ── ADMIN FORGOT PASSWORD ──
function showAdminForgot() {
  document.getElementById('a-login-main').style.display = 'none';
  document.getElementById('a-reset-1').style.display = 'block';
  document.getElementById('a-reset-2').style.display = 'none';
  document.getElementById('a-reset-err-1').textContent = '';
  const btn = document.getElementById('a-reset-send-btn');
  if (btn) { btn.disabled = false; btn.textContent = 'SEND RESET CODE'; }
}
function showAdminLogin() {
  document.getElementById('a-login-main').style.display = 'block';
  document.getElementById('a-reset-1').style.display = 'none';
  document.getElementById('a-reset-2').style.display = 'none';
}
async function submitAdminResetRequest() {
  const btn = document.getElementById('a-reset-send-btn');
  btn.disabled = true; btn.textContent = 'SENDING...';
  try {
    const res = await fetch(AAPI + '/api/admin-reset-request', { method: 'POST' });
    const data = await res.json().catch(() => ({ error: 'Server error' }));
    if (data.success) {
      document.getElementById('a-reset-1').style.display = 'none';
      document.getElementById('a-reset-2').style.display = 'block';
      document.getElementById('a-reset-otp').value = '';
      document.getElementById('a-reset-newpw').value = '';
      document.getElementById('a-reset-err-2').textContent = '';
    } else {
      document.getElementById('a-reset-err-1').textContent = data.error || 'Failed to send code.';
      btn.disabled = false; btn.textContent = 'SEND RESET CODE';
    }
  } catch(e) {
    document.getElementById('a-reset-err-1').textContent = 'Connection error.';
    btn.disabled = false; btn.textContent = 'SEND RESET CODE';
  }
}
async function submitAdminResetVerify() {
  const otp = document.getElementById('a-reset-otp').value.trim();
  const newpw = document.getElementById('a-reset-newpw').value;
  if (!otp || otp.length < 6) { document.getElementById('a-reset-err-2').textContent = 'Enter the 6-digit code.'; return; }
  if (!newpw || newpw.length < 6) { document.getElementById('a-reset-err-2').textContent = 'Password must be at least 6 characters.'; return; }
  const btn = document.getElementById('a-reset-verify-btn');
  btn.disabled = true; btn.textContent = 'VERIFYING...';
  try {
    const res = await fetch(AAPI + '/api/admin-reset-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp, newPassword: newpw })
    });
    const data = await res.json().catch(() => ({ error: 'Server error' }));
    if (data.success) {
      showAdminLogin();
      document.getElementById('a-pw').value = '';
      const err = document.getElementById('a-err');
      err.style.color = 'var(--green)';
      err.textContent = '✓ Password updated. Please log in with your new password.';
      setTimeout(() => { err.textContent = ''; err.style.color = ''; }, 6000);
    } else {
      document.getElementById('a-reset-err-2').textContent = data.error || 'Incorrect or expired code.';
      btn.disabled = false; btn.textContent = 'SET NEW PASSWORD';
    }
  } catch(e) {
    document.getElementById('a-reset-err-2').textContent = 'Connection error.';
    btn.disabled = false; btn.textContent = 'SET NEW PASSWORD';
  }
}

// ── ADMIN LOGIN ──
document.getElementById('a-login-btn').onclick = doAdminLogin;
document.getElementById('a-pw').onkeydown = e => { if(e.key==='Enter') doAdminLogin(); };
async function doAdminLogin() {
  const pw = document.getElementById('a-pw').value.trim();
  if(!pw) return;
  const btn = document.getElementById('a-login-btn');
  btn.disabled = true; btn.textContent = 'VERIFYING...';
  try {
    const res = await fetch(AAPI + '/api/admin/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({password: pw})
    });
    const data = await res.json().catch(() => ({error: 'Server error (HTTP ' + res.status + ') — check KV binding in Cloudflare dashboard'}));
    if(data.token){ setAdminToken(data.token); enterAdmin(); }
    else { document.getElementById('a-err').textContent = data.error || 'Incorrect password.'; btn.disabled=false; btn.textContent='ACCESS ADMIN →'; }
  } catch(e){ document.getElementById('a-err').textContent = 'Connection error: ' + e.message; btn.disabled=false; btn.textContent='ACCESS ADMIN →'; }
}

function enterAdmin() {
  document.getElementById('admin-login').classList.add('hidden');
  document.getElementById('admin-app').classList.remove('hidden');
  showView('clients');
}

document.getElementById('a-logout').onclick = function(){ clearAdminToken(); window.location.reload(); };

// ── VIEWS ──
function showView(view) {
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const link = document.querySelector(\`.sidebar-link[data-view="\${view}"]\`);
  if(link) link.classList.add('active');
  if(view==='clients') renderClients();
  else if(view==='new-client') renderNewClientForm();
  else if(view==='settings') renderSettings();
}

// ── ALL CLIENTS ──
async function renderClients() {
  const main = document.getElementById('admin-main');
  main.innerHTML = '<div style="color:#555;padding:40px 0">Loading clients...</div>';
  try {
    const res = await fetch(AAPI+'/api/admin/clients', { headers:{'Authorization':'Bearer '+getAdminToken()} });
    const data = await res.json();
    currentClients = data.clients || [];
    main.innerHTML = \`
      <div class="page-header">
        <div><div class="page-title">All Clients</div><div class="page-sub">\${currentClients.length} portal\${currentClients.length!==1?'s':''} total</div></div>
        <button class="btn btn-gold" onclick="showView('new-client')">+ New Client</button>
      </div>
      \${currentClients.length ? currentClients.map(c => \`
        <div class="client-card">
          <div class="client-info">
            <div class="client-name">\${c.name} <span class="status-pill pill-\${c.status}">\${c.status.replace('_',' ')}</span></div>
            <div class="client-meta">
              <span>\${c.event||'—'}</span>
              <span>/\${c.id}</span>
              <span>Created \${new Date(c.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
            </div>
          </div>
          <div class="client-actions">
            <button class="btn btn-outline btn-sm" onclick="openClientPortal('\${c.id}')">Open Portal ↗</button>
            <button class="btn btn-gold btn-sm" onclick="editClient('\${c.id}')">Manage →</button>
          </div>
        </div>\`).join('') : '<div class="empty-state"><h3>No clients yet.</h3><p>Create your first client portal.</p></div>'}\`;
  } catch(e){ main.innerHTML = '<div style="color:var(--red);padding:20px">Error loading clients.</div>'; }
}

function openClientPortal(id) { window.open('/'+id,'_blank'); }

// ── EDIT CLIENT ──
async function editClient(id) {
  currentClientId = id;
  currentJobId = null;
  const main = document.getElementById('admin-main');
  main.innerHTML = '<div style="color:#555;padding:40px 0">Loading...</div>';
  try {
    const fetchOpts = () => ({ cache:'no-store', headers:{'Authorization':'Bearer '+getAdminToken()} });
    const [cRes, jRes] = await Promise.all([
      fetch(AAPI+'/api/admin/clients/'+id, fetchOpts()),
      fetch(AAPI+'/api/admin/clients/'+id+'/jobs', fetchOpts())
    ]);
    const client = await cRes.json();
    const {jobs} = await jRes.json();
    renderClientDetail(client, jobs||[]);
  } catch(e){ main.innerHTML = '<div style="color:var(--red);padding:20px">Error loading client.</div>'; }
}

function renderClientDetail(client, jobs) {
  const main = document.getElementById('admin-main');
  main.innerHTML = \`
    <div class="page-header">
      <div>
        <button class="btn btn-outline btn-sm" onclick="showView('clients')" style="margin-bottom:10px">← All Clients</button>
        <div class="page-title">\${client.name}</div>
        <div class="page-sub">\${client.event||''} · <span class="status-pill pill-\${client.status}">\${client.status.replace('_',' ')}</span></div>
        <div class="portal-url">portal.myluckyblackmedia.com/\${client.id}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-outline btn-sm" onclick="openClientPortal('\${client.id}')">Open Portal ↗</button>
        <button class="btn btn-danger btn-sm" onclick="deleteClient('\${client.id}','\${esc(client.name)}')">Delete Client</button>
      </div>
    </div>
    <div class="tabs">
      <button class="tab active" onclick="switchDetailTab('info',this)">Info</button>
      <button class="tab" onclick="switchDetailTab('jobs',this)">Jobs (\${jobs.length})</button>
    </div>
    <div id="detail-tab-info" class="detail-tab">
      \${renderInfoTab(client)}
    </div>
    <div id="detail-tab-jobs" class="detail-tab hidden">
      \${renderJobsTab(jobs, client.id)}
    </div>\`;
}

function switchDetailTab(name, el) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.detail-tab').forEach(t=>t.classList.add('hidden'));
  document.getElementById('detail-tab-'+name).classList.remove('hidden');
}

function renderInfoTab(c) {
  const savedMsg = window._savedClientMsg || '';
  if (savedMsg) window._savedClientMsg = null;
  return \`
    <div id="info-msg" \${savedMsg ? 'class="msg msg-success" style="display:block"' : ''}\>\${savedMsg}\</div\>
    <div class="form-grid">
      <div class="form-group"><label class="flabel">Client / Business Name</label><input class="finput" id="ci-name" value="\${esc(c.name)}"></div>
      <div class="form-group"><label class="flabel">Event / Project</label><input class="finput" id="ci-event" value="\${esc(c.event||'')}"></div>
      <div class="form-group"><label class="flabel">Portal Slug (URL)</label><input class="finput" id="ci-id" value="\${esc(c.id)}" disabled><div class="fhint">portal.myluckyblackmedia.com/\${c.id}</div></div>
      <div class="form-group"><label class="flabel">Status</label><select class="fselect" id="ci-status"><option value="active" \${c.status==='active'?'selected':''}>Active</option><option value="in_review" \${c.status==='in_review'?'selected':''}>In Review</option><option value="closed" \${c.status==='closed'?'selected':''}>Closed</option><option value="archived" \${c.status==='archived'?'selected':''}>Archived</option></select></div>
      <div class="form-group"><label class="flabel">Project Phase</label><select class="fselect" id="ci-phase"><option value="in_progress" \${c.phase==='in_progress'?'selected':''}>In Progress</option><option value="in_review" \${c.phase==='in_review'?'selected':''}>In Review</option><option value="complete" \${c.phase==='complete'?'selected':''}>Complete</option></select></div>
      <div class="form-group"><label class="flabel">Expiry Date <span class="fhint" style="display:inline">(optional — auto-closes)</span></label><input class="finput" type="date" id="ci-expiry" value="\${c.expiry_date||''}"></div>
      <div class="form-group span2"><label class="flabel">Admin Note to Client</label><textarea class="ftextarea" id="ci-note" style="min-height:100px">\${esc(c.admin_note||'')}</textarea><div class="fhint">Client sees this in their "From Your Producer" section. Updates live instantly.</div></div>
      <div class="form-group"><label class="flabel">Client Email <span class="fhint" style="display:inline">(for password reset)</span></label><input class="finput" type="email" id="ci-email" value="\${esc(c.email||'')}" placeholder="client@email.com"></div>
      <div class="form-group"><label class="flabel">Set New Password <span class="fhint" style="display:inline">(leave blank to keep current)</span></label><input class="finput" type="password" id="ci-newpw" placeholder="Enter new access code"><div class="fhint">Current password is hashed — cannot be viewed. Enter a new one to reset it.</div></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-gold" onclick="saveClientInfo('\${c.id}')">Save Changes</button>
      <button class="btn btn-outline" onclick="navigator.clipboard.writeText('portal.myluckyblackmedia.com/\${c.id}')">Copy Portal URL</button>
      <button class="btn btn-outline" onclick="sendPortalEmailToClient('\${c.id}')" title="Send portal link &amp; access instructions to client's email on file">✉ Send Portal Email</button>
    </div>\`;
}

async function saveClientInfo(id) {
  const payload = {
    name: document.getElementById('ci-name').value,
    event: document.getElementById('ci-event').value,
    status: document.getElementById('ci-status').value,
    phase: document.getElementById('ci-phase').value,
    expiry_date: document.getElementById('ci-expiry').value || null,
    admin_note: document.getElementById('ci-note').value,
    email: document.getElementById('ci-email').value.trim()
  };
  const newpw = document.getElementById('ci-newpw').value;
  if (newpw) payload.newPassword = newpw;
  const btn = document.querySelector('.form-actions .btn-gold');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    const res = await fetch(AAPI+'/api/admin/clients/'+id, {
      method:'PUT', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getAdminToken()},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      // DB write confirmed — re-render the client detail with fresh data from server
      window._savedClientMsg = '\u2713 Changes saved successfully.';
      editClient(id);
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
      const msg = document.getElementById('info-msg');
      if (msg) {
        msg.className = 'msg msg-error';
        msg.style.display = 'block';
        msg.textContent = 'Error: ' + (data.error || 'Could not save changes.');
      }
      console.error('saveClientInfo error:', data.error, data);
    }
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
    const msg = document.getElementById('info-msg');
    if (msg) { msg.className='msg msg-error'; msg.style.display='block'; msg.textContent='Connection error saving changes.'; }
    console.error('saveClientInfo exception:', e);
  }
}

async function sendPortalEmailToClient(id) {
  const btn = event && event.target;
  const origText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
  try {
    const res = await fetch(AAPI+'/api/admin/clients/'+id+'/send-portal-email', {
      method: 'POST', headers: {'Authorization':'Bearer '+getAdminToken()}
    });
    const data = await res.json();
    const msg = document.getElementById('info-msg');
    if (data.success) {
      if (msg) { msg.className='msg msg-success'; msg.textContent='Portal access email sent to client.'; msg.classList.remove('hidden'); setTimeout(()=>{msg.textContent='';msg.classList.add('hidden');},4000); }
    } else {
      if (msg) { msg.className='msg msg-error'; msg.textContent='Email failed: '+(data.error||'Unknown error'); msg.classList.remove('hidden'); }
    }
  } catch(e) {
    const msg = document.getElementById('info-msg');
    if (msg) { msg.className='msg msg-error'; msg.textContent='Connection error sending email.'; msg.classList.remove('hidden'); }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
}

function renderFilesTab(files, clientId) {
  return \`
    <div class="page-header" style="margin-bottom:16px">
      <div style="font-size:13px;color:var(--silver)">File delivery cards shown on the client's dashboard.</div>
      <button class="btn btn-gold btn-sm" onclick="openAddFileModal('\${clientId}')">+ Add File Card</button>
    </div>
    <div id="files-list">
      \${files.length ? files.map(f=>\`
        <div class="file-row" id="file-row-\${f.id}">
          <div class="file-row-icon">\${f.icon||'📁'}</div>
          <div class="file-row-info">
            <div class="file-row-label">\${esc(f.label)} <span style="font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;margin-left:6px">\${f.access_level}</span></div>
            <div class="file-row-url">\${esc(f.drive_url)}</div>
          </div>
          <div class="file-row-actions">
            <button class="btn btn-outline btn-sm" onclick="openEditFileModal(\${f.id},'\${esc(f.label)}','\${esc(f.icon)}','\${esc(f.drive_url)}','\${esc(f.subtitle)}','\${esc(f.description)}','\${f.access_level}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteFile(\${f.id},'\${clientId}')">Del</button>
          </div>
        </div>\`).join('') : '<div class="empty-state" style="padding:32px"><h3>No files yet.</h3><p>Add a Google Drive link to create the first file card.</p></div>'}
    </div>\`;
}

function renderJobsTab(jobs, clientId) {
  const phaseLabel = { in_progress:'In Progress', in_review:'In Review', complete:'Complete' };
  const phasePill  = { in_progress:'pill-active', in_review:'pill-in_review', complete:'pill-archived' };
  return \`
    <div class="page-header" style="margin-bottom:16px">
      <div style="font-size:13px;color:var(--silver)">Each job has its own files, review setup, and submissions. Click a job to manage it.</div>
      <button class="btn btn-gold btn-sm" onclick="openAddJobModal('\${clientId}')">+ Add Job</button>
    </div>
    <div id="jobs-list">
      \${jobs.length ? jobs.map(j => \`
        <div class="file-row" id="job-row-\${j.id}" style="align-items:flex-start;gap:14px">
          <div style="flex:1;min-width:0;cursor:pointer" onclick="openJob(\${j.id},'\${clientId}')">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <div style="font-size:14px;font-weight:600;color:var(--white)">\${esc(j.title)}</div>
              <span class="status-pill \${phasePill[j.phase]||'pill-archived'}" style="font-size:9px">\${phaseLabel[j.phase]||j.phase}</span>
            </div>
            \${j.description ? \`<div style="font-size:12px;color:var(--silver);margin-bottom:4px">\${esc(j.description)}</div>\` : ''}
            \${j.admin_note ? \`<div style="font-size:11px;color:#666;font-style:italic">Note: \${esc(j.admin_note)}</div>\` : ''}
          </div>
          <div class="file-row-actions" style="flex-shrink:0">
            <button class="btn btn-gold btn-sm" onclick="openJob(\${j.id},'\${clientId}')">Open →</button>
            <button class="btn btn-outline btn-sm" onclick="openEditJobModal(\${j.id},'\${esc(j.title)}','\${esc(j.description||'')}','\${j.phase}','\${esc(j.admin_note||'')}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteJob(\${j.id},'\${clientId}')">Del</button>
          </div>
        </div>\`).join('') : '<div class="empty-state" style="padding:32px"><h3>No jobs yet.</h3><p>Add the first job to start managing files and reviews for this client.</p></div>'}
    </div>\`;
}

// ── JOB DETAIL VIEW ──
async function openJob(jobId, clientId) {
  currentJobId = jobId;
  const main = document.getElementById('admin-main');
  main.innerHTML = '<div style="color:#555;padding:40px 0">Loading job...</div>';
  try {
    const opts = () => ({ cache:'no-store', headers:{'Authorization':'Bearer '+getAdminToken()} });
    const [jRes, fRes, riRes, rvRes] = await Promise.all([
      fetch(AAPI+'/api/admin/jobs/'+jobId, opts()),
      fetch(AAPI+'/api/admin/jobs/'+jobId+'/files', opts()),
      fetch(AAPI+'/api/admin/jobs/'+jobId+'/review-items', opts()),
      fetch(AAPI+'/api/admin/jobs/'+jobId+'/reviews', opts())
    ]);
    const job = await jRes.json();
    const {files} = await fRes.json();
    const {items} = await riRes.json();
    const {reviews, items: reviewItems} = await rvRes.json();
    renderJobDetail(job, files||[], items||[], reviews||[], clientId);
  } catch(e) {
    document.getElementById('admin-main').innerHTML = '<div style="color:var(--red);padding:20px">Error loading job.</div>';
  }
}

function renderJobDetail(job, files, items, reviews, clientId) {
  const phaseLabel = { in_progress:'In Progress', in_review:'In Review', complete:'Complete' };
  const phasePill  = { in_progress:'pill-active', in_review:'pill-in_review', complete:'pill-archived' };
  const main = document.getElementById('admin-main');
  const reviewCount = reviews.length;
  main.innerHTML = \`
    <div class="page-header">
      <div>
        <button class="btn btn-outline btn-sm" onclick="editClient('\${clientId}')" style="margin-bottom:10px">← Back to Client</button>
        <div class="page-title">\${esc(job.title)}</div>
        <div class="page-sub"><span class="status-pill \${phasePill[job.phase]||'pill-archived'}">\${phaseLabel[job.phase]||job.phase}</span>\${job.description ? ' · '+esc(job.description) : ''}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="openEditJobModal(\${job.id},'\${esc(job.title)}','\${esc(job.description||'')}','\${job.phase}','\${esc(job.admin_note||'')}')">Edit Job Info</button>
    </div>
    <div class="tabs">
      <button class="tab active" onclick="switchDetailTab('jfiles',this)">Files (\${files.length})</button>
      <button class="tab" onclick="switchDetailTab('jreview-items',this)">Review Setup (\${items.length})</button>
      <button class="tab" onclick="switchDetailTab('jreviews',this)">Submissions \${reviewCount?'<span style=\\'color:var(--gold)\\'>●</span>':''}</button>
    </div>
    <div id="detail-tab-jfiles" class="detail-tab">
      \${renderJobFilesTab(files, job.id, clientId)}
    </div>
    <div id="detail-tab-jreview-items" class="detail-tab hidden">
      \${renderJobReviewSetupTab(items, files, job.id, clientId)}
    </div>
    <div id="detail-tab-jreviews" class="detail-tab hidden">
      \${renderReviewsTab(reviews, items)}
    </div>\`;
}

function renderJobFilesTab(files, jobId, clientId) {
  return \`
    <div class="page-header" style="margin-bottom:16px">
      <div style="font-size:13px;color:var(--silver)">File delivery cards for this job shown on the client's dashboard.</div>
      <button class="btn btn-gold btn-sm" onclick="openAddJobFileModal(\${jobId},'\${clientId}')">+ Add File Card</button>
    </div>
    <div id="files-list">
      \${files.length ? files.map(f=>\`
        <div class="file-row" id="file-row-\${f.id}">
          <div class="file-row-icon">\${f.icon||'📁'}</div>
          <div class="file-row-info">
            <div class="file-row-label">\${esc(f.label)} <span style="font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;margin-left:6px">\${f.access_level}</span></div>
            <div class="file-row-url">\${esc(f.drive_url)}</div>
          </div>
          <div class="file-row-actions">
            <button class="btn btn-outline btn-sm" onclick="openEditFileModal(\${f.id},'\${esc(f.label)}','\${esc(f.icon)}','\${esc(f.drive_url)}','\${esc(f.subtitle)}','\${esc(f.description)}','\${f.access_level}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteJobFile(\${f.id},\${jobId},'\${clientId}')">Del</button>
          </div>
        </div>\`).join('') : '<div class="empty-state" style="padding:32px"><h3>No files yet.</h3><p>Add a Google Drive link to create the first file card for this job.</p></div>'}
    </div>\`;
}

function renderJobReviewSetupTab(items, files, jobId, clientId) {
  const cats = (files||[]).filter(f => f.access_level === 'review_folder');
  return \`
    <div style="margin-bottom:28px">
      <div class="page-header" style="margin-bottom:12px">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--white);margin-bottom:2px">Deliverable Categories</div>
          <div style="font-size:12px;color:var(--silver)">Each category = a Drive folder tab in the client's review section.</div>
        </div>
        <button class="btn btn-gold btn-sm" onclick="openAddJobCategoryModal(\${jobId},'\${clientId}')">+ Add Category</button>
      </div>
      <div id="category-admin-list">
        \${cats.length ? cats.map(c=>\`
          <div class="file-row" id="cat-row-\${c.id}">
            <div class="file-row-icon">🗂</div>
            <div class="file-row-info">
              <div class="file-row-label" style="color:var(--gold)">\${esc(c.label)}</div>
              <div class="file-row-url">\${esc(c.drive_url)}</div>
            </div>
            <div class="file-row-actions">
              <button class="btn btn-outline btn-sm" onclick="openEditCategoryModal(\${c.id},'\${esc(c.label)}','\${esc(c.drive_url)}')">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteJobFile(\${c.id},\${jobId},'\${clientId}')">Del</button>
            </div>
          </div>\`).join('') : '<div style="padding:16px 0;color:#555;font-size:12px">No categories yet — add a Drive folder to get started.</div>'}
      </div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:24px">
      <div class="page-header" style="margin-bottom:12px">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--white);margin-bottom:2px">Manual Review Items</div>
          <div style="font-size:12px;color:var(--silver)">One-off items for this job shown as a flat list.</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="openAddJobReviewItemModal(\${jobId},'\${clientId}')">+ Add Item</button>
      </div>
      <div id="review-items-admin-list">
        \${items.length ? items.map(i=>\`
          <div class="review-row" id="ri-row-\${i.id}">
            <div class="review-row-info">
              <div class="review-row-label">\${esc(i.label)} <span class="review-row-type">\${i.type}</span></div>
              \${i.description?\`<div style="font-size:11px;color:var(--silver);margin-top:4px">\${esc(i.description)}</div>\`:''}
            </div>
            <div class="review-row-actions">
              <button class="btn btn-danger btn-sm" onclick="deleteJobReviewItem(\${i.id},\${jobId},'\${clientId}')">Del</button>
            </div>
          </div>\`).join('') : '<div style="padding:16px 0;color:#555;font-size:12px">No manual items — add one for deliverables not in a Drive folder.</div>'}
      </div>
    </div>\`;
}

function renderReviewItemsTab(items, clientId, allFiles) {
  const cats = (allFiles||[]).filter(f => f.access_level === 'review_folder');
  return \`
    <div style="margin-bottom:28px">
      <div class="page-header" style="margin-bottom:12px">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--white);margin-bottom:2px">Deliverable Categories</div>
          <div style="font-size:12px;color:var(--silver)">Each category = a Drive folder tab in the client's review section. Files auto-load by name.</div>
        </div>
        <button class="btn btn-gold btn-sm" onclick="openAddCategoryModal('\${clientId}')">+ Add Category</button>
      </div>
      <div id="category-admin-list">
        \${cats.length ? cats.map(c=>\`
          <div class="file-row" id="cat-row-\${c.id}">
            <div class="file-row-icon">🗂</div>
            <div class="file-row-info">
              <div class="file-row-label" style="color:var(--gold)">\${esc(c.label)}</div>
              <div class="file-row-url">\${esc(c.drive_url)}</div>
            </div>
            <div class="file-row-actions">
              <button class="btn btn-outline btn-sm" onclick="openEditCategoryModal(\${c.id},'\${esc(c.label)}','\${esc(c.drive_url)}')">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteFile(\${c.id},'\${clientId}')">Del</button>
            </div>
          </div>\`).join('') : '<div style="padding:16px 0;color:#555;font-size:12px">No categories yet — add a Drive folder to get started.</div>'}
      </div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:24px">
      <div class="page-header" style="margin-bottom:12px">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--white);margin-bottom:2px">Manual Review Items</div>
          <div style="font-size:12px;color:var(--silver)">One-off items without a Drive folder (shown as a flat list alongside categories).</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="openAddReviewItemModal('\${clientId}')">+ Add Item</button>
      </div>
      <div id="review-items-admin-list">
        \${items.length ? items.map(i=>\`
          <div class="review-row" id="ri-row-\${i.id}">
            <div class="review-row-info">
              <div class="review-row-label">\${esc(i.label)} <span class="review-row-type">\${i.type}</span></div>
              \${i.description?\`<div style="font-size:11px;color:var(--silver);margin-top:4px">\${esc(i.description)}</div>\`:''}
            </div>
            <div class="review-row-actions">
              <button class="btn btn-danger btn-sm" onclick="deleteReviewItem(\${i.id},'\${clientId}')">Del</button>
            </div>
          </div>\`).join('') : '<div style="padding:16px 0;color:#555;font-size:12px">No manual items — add one for deliverables not in a Drive folder.</div>'}
      </div>
    </div>\`;
}

function renderReviewsTab(reviews, items) {
  if(!reviews.length) return '<div class="empty-state"><h3>No reviews submitted yet.</h3><p>Once the client submits their review, you\\'ll see their ratings here.</p></div>';
  const lastSubmit = reviews[reviews.length-1]?.submitted_at;
  const header = \`<div class="submitted-header"><span>✓ Review submitted\${lastSubmit?' · '+new Date(lastSubmit).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):''}</span></div>\`;
  let rows = '';
  if (items.length) {
    // Manual review items — use String() keys to avoid integer/string mismatch
    const rMap = {};
    reviews.forEach(r => { rMap[String(r.item_id)] = r; });
    rows = items.map(item => {
      const r = rMap[String(item.id)];
      const ratingClass = r ? 'rating-'+r.rating : 'rating-unrated';
      const ratingText = r ? r.rating.charAt(0).toUpperCase()+r.rating.slice(1) : 'Unrated';
      return \`<div class="rating-row">
        <div class="rating-label">\${esc(item.label)}</div>
        <span class="rating-pill \${ratingClass}">\${ratingText}</span>
        \${r&&r.note?\`<div class="rating-note">"\${esc(r.note)}"</div>\`:''}
      </div>\`;
    }).join('');
  } else {
    // Drive-based reviews — no review_items rows; render directly from responses using stored label
    rows = reviews.map(r => {
      const label = r.label || r.item_id || 'Item';
      const ratingClass = r.rating ? 'rating-'+r.rating : 'rating-unrated';
      const ratingText = r.rating ? r.rating.charAt(0).toUpperCase()+r.rating.slice(1) : 'Unrated';
      return \`<div class="rating-row">
        <div class="rating-label">\${esc(label)}</div>
        <span class="rating-pill \${ratingClass}">\${ratingText}</span>
        \${r.note?\`<div class="rating-note">"\${esc(r.note)}"</div>\`:''}
      </div>\`;
    }).join('');
  }
  return header + rows;
}

// ── NEW CLIENT ──
function renderNewClientForm() {
  const main = document.getElementById('admin-main');
  main.innerHTML = \`
    <div class="page-header"><div><div class="page-title">New Client Portal</div><div class="page-sub">Creates a live portal instantly.</div></div></div>
    <div id="nc-msg"></div>
    <div class="form-grid">
      <div class="form-group"><label class="flabel">Client / Business Name *</label><input class="finput" id="nc-name" placeholder="Nova Collective"></div>
      <div class="form-group"><label class="flabel">Event / Project *</label><input class="finput" id="nc-event" placeholder="Brand Identity Package"></div>
      <div class="form-group"><label class="flabel">URL Slug *</label><input class="finput" id="nc-id" placeholder="nova-brand-2026"><div class="fhint">portal.myluckyblackmedia.com/<span id="nc-slug-preview">nova-brand-2026</span></div></div>
      <div class="form-group"><label class="flabel">Portal Password *</label><input class="finput" id="nc-pw" placeholder="nova-brand-2026"><div class="fhint">Client's access code — share this with them.</div></div>
      <div class="form-group"><label class="flabel">Client Email (for password reset)</label><input class="finput" type="email" id="nc-email" placeholder="client@email.com"></div>
      <div class="form-group"><label class="flabel">Service Type</label><select class="fselect" id="nc-service"><option value="event">Event</option><option value="photo">Photography</option><option value="brand">Branding</option><option value="video">Video</option></select></div>
      <div class="form-group"><label class="flabel">Initial Status</label><select class="fselect" id="nc-status"><option value="active">Active</option><option value="in_review">In Review</option></select></div>
      <div class="form-group"><label class="flabel">Expiry Date (optional)</label><input class="finput" type="date" id="nc-expiry"></div>
      <div class="form-group span2"><label class="flabel">Initial Note to Client</label><textarea class="ftextarea" id="nc-note" placeholder="Your files are ready. Please review and let us know your feedback."></textarea></div>
    </div>
    <div class="form-actions"><button class="btn btn-gold" onclick="createClient()">Create Portal →</button></div>\`;
  document.getElementById('nc-id').oninput = function(){ document.getElementById('nc-slug-preview').textContent = this.value||'...'; };
  document.getElementById('nc-name').oninput = function(){
    const slug = this.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    document.getElementById('nc-id').value = slug;
    document.getElementById('nc-slug-preview').textContent = slug;
  };
}

async function createClient() {
  const payload = {
    id: document.getElementById('nc-id').value.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-'),
    name: document.getElementById('nc-name').value.trim(),
    event: document.getElementById('nc-event').value.trim(),
    password: document.getElementById('nc-pw').value.trim(),
    service_type: document.getElementById('nc-service').value,
    status: document.getElementById('nc-status').value,
    expiry_date: document.getElementById('nc-expiry').value || null,
    admin_note: document.getElementById('nc-note').value.trim(),
    email: document.getElementById('nc-email').value.trim(),
    phase: 'in_progress'
  };
  if(!payload.id||!payload.name||!payload.password){ alert('Name, slug, and password are required.'); return; }
  try {
    const res = await fetch(AAPI+'/api/admin/clients', {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getAdminToken()},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    const msg = document.getElementById('nc-msg');
    if(data.success){
      msg.className='msg msg-success';
      msg.innerHTML=\`Portal created! URL: <strong>portal.myluckyblackmedia.com/\${payload.id}</strong> · Password: <strong>\${payload.password}</strong>\`;
      setTimeout(()=>editClient(payload.id), 2000);
    } else { msg.className='msg msg-error'; msg.textContent = data.error || 'Error creating portal.'; }
  } catch(e){ console.error(e); }
}

// ── SETTINGS ──
function renderSettings() {
  document.getElementById('admin-main').innerHTML = \`
    <div class="page-header"><div class="page-title">Settings</div></div>
    <div class="info-box">Admin portal for Lucky Black Media &amp; Design. Cloudflare D1 + Workers backend.</div>
    <div class="form-grid" style="max-width:480px">
      <div class="form-group span2"><label class="flabel">EmailJS Service ID</label><input class="finput" id="s-emailjs-service" placeholder="service_xxxxxxx" value="\${localStorage.getItem('emailjs_service')||''}"></div>
      <div class="form-group span2"><label class="flabel">EmailJS Template ID</label><input class="finput" id="s-emailjs-template" placeholder="template_xxxxxxx" value="\${localStorage.getItem('emailjs_template')||''}"></div>
      <div class="form-group span2"><label class="flabel">EmailJS Public Key</label><input class="finput" id="s-emailjs-key" placeholder="your_public_key" value="\${localStorage.getItem('emailjs_public_key')||''}"></div>
    </div>
    <div class="form-actions"><button class="btn btn-gold" onclick="saveSettings()">Save EmailJS Config</button></div>\`;
}
function saveSettings() {
  localStorage.setItem('emailjs_service', document.getElementById('s-emailjs-service').value);
  localStorage.setItem('emailjs_template', document.getElementById('s-emailjs-template').value);
  localStorage.setItem('emailjs_public_key', document.getElementById('s-emailjs-key').value);
  alert('Settings saved.');
}

// ── CATEGORY MODALS ──
function openAddCategoryModal(clientId) {
  document.getElementById('modal-content').innerHTML = \`
    <div class="modal-header"><div class="modal-title">Add Deliverable Category</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="modal-msg"></div>
    <div class="form-grid">
      <div class="form-group span2"><label class="flabel">Category Name *</label><input class="finput" id="cat-label" placeholder="Highlight Reel"><div class="fhint">This becomes the tab label in the client's review section.</div></div>
      <div class="form-group span2"><label class="flabel">Google Drive Folder URL *</label><input class="finput" id="cat-url" placeholder="https://drive.google.com/drive/folders/..."><div class="fhint">All files in this folder will auto-load for review.</div></div>
    </div>
    <div class="form-actions"><button class="btn btn-gold" onclick="addCategory('\${clientId}')">Add Category</button><button class="btn btn-outline" onclick="closeModal()">Cancel</button></div>\`;
  showModal();
}

async function addCategory(clientId) {
  const label = document.getElementById('cat-label').value.trim();
  const url = document.getElementById('cat-url').value.trim();
  if (!label || !url) { document.getElementById('modal-msg').innerHTML = '<div class="msg msg-error">Category name and folder URL are required.</div>'; return; }
  try {
    const res = await fetch(AAPI+'/api/admin/clients/'+clientId+'/files', {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getAdminToken()},
      body: JSON.stringify({ label, icon:'🗂', drive_url: url, subtitle:'', description:'', access_level:'review_folder' })
    });
    const data = await res.json();
    if (data.success) { closeModal(); editClient(clientId); }
    else { document.getElementById('modal-msg').innerHTML = '<div class="msg msg-error">'+(data.error||'Error')+'</div>'; }
  } catch(e) { console.error(e); }
}

function openEditCategoryModal(id, label, url) {
  document.getElementById('modal-content').innerHTML = \`
    <div class="modal-header"><div class="modal-title">Edit Deliverable Category</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="modal-msg"></div>
    <div class="form-grid">
      <div class="form-group span2"><label class="flabel">Category Name</label><input class="finput" id="ecat-label" value="\${label}"></div>
      <div class="form-group span2"><label class="flabel">Google Drive Folder URL</label><input class="finput" id="ecat-url" value="\${url}"></div>
    </div>
    <div class="form-actions"><button class="btn btn-gold" onclick="updateCategory(\${id})">Save</button><button class="btn btn-outline" onclick="closeModal()">Cancel</button></div>\`;
  showModal();
}

async function updateCategory(id) {
  const label = document.getElementById('ecat-label').value.trim();
  const url = document.getElementById('ecat-url').value.trim();
  try {
    const res = await fetch(AAPI+'/api/admin/files/'+id, {
      method:'PUT', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getAdminToken()},
      body: JSON.stringify({ label, icon:'🗂', drive_url: url, subtitle:'', description:'', access_level:'review_folder' })
    });
    const data = await res.json();
    if (data.success) { closeModal(); if(currentJobId){openJob(currentJobId,currentClientId);}else{editClient(currentClientId);} }
    else { document.getElementById('modal-msg').innerHTML = '<div class="msg msg-error">'+(data.error||'Error')+'</div>'; }
  } catch(e) { console.error(e); }
}

// ── FILE CARD MODALS ──
function openAddFileModal(clientId) {
  document.getElementById('modal-content').innerHTML = \`
    <div class="modal-header"><div class="modal-title">Add File Card</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="modal-msg"></div>
    <div class="form-grid">
      <div class="form-group"><label class="flabel">Label *</label><input class="finput" id="mf-label" placeholder="Final Deliverables"></div>
      <div class="form-group"><label class="flabel">Icon (emoji)</label><input class="finput" id="mf-icon" placeholder="📁" maxlength="4"></div>
      <div class="form-group span2"><label class="flabel">Google Drive URL *</label><input class="finput" id="mf-url" placeholder="https://drive.google.com/..."></div>
      <div class="form-group"><label class="flabel">Subtitle</label><input class="finput" id="mf-subtitle" placeholder="LBMD Delivery Suite"></div>
      <div class="form-group"><label class="flabel">Description</label><input class="finput" id="mf-desc" placeholder="Export-ready files"></div>
      <div class="form-group"><label class="flabel">Access Level</label><select class="fselect" id="mf-access"><option value="free">Free (always visible)</option><option value="paid">Paid Gate (locked until paid)</option><option value="admin_only">Admin Only (hidden from client)</option></select></div>
    </div>
    <div class="form-actions"><button class="btn btn-gold" onclick="addFile('\${clientId}')">Add File Card</button><button class="btn btn-outline" onclick="closeModal()">Cancel</button></div>\`;
  showModal();
}

async function addFile(clientId) {
  const payload = {
    label: document.getElementById('mf-label').value.trim(),
    icon: document.getElementById('mf-icon').value.trim()||'📁',
    drive_url: document.getElementById('mf-url').value.trim(),
    subtitle: document.getElementById('mf-subtitle').value.trim(),
    description: document.getElementById('mf-desc').value.trim(),
    access_level: document.getElementById('mf-access').value
  };
  if(!payload.label||!payload.drive_url){ document.getElementById('modal-msg').innerHTML='<div class="msg msg-error">Label and Drive URL are required.</div>'; return; }
  try {
    const res = await fetch(AAPI+'/api/admin/clients/'+clientId+'/files',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getAdminToken()},
      body:JSON.stringify(payload)
    });
    const data = await res.json();
    if(data.success){ closeModal(); editClient(clientId); }
    else { document.getElementById('modal-msg').innerHTML='<div class="msg msg-error">'+( data.error||'Error')+'</div>'; }
  } catch(e){ console.error(e); }
}

function openEditFileModal(id,label,icon,url,subtitle,description,access_level){
  document.getElementById('modal-content').innerHTML=\`
    <div class="modal-header"><div class="modal-title">Edit File Card</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="modal-msg"></div>
    <div class="form-grid">
      <div class="form-group"><label class="flabel">Label</label><input class="finput" id="ef-label" value="\${label}"></div>
      <div class="form-group"><label class="flabel">Icon</label><input class="finput" id="ef-icon" value="\${icon}" maxlength="4"></div>
      <div class="form-group span2"><label class="flabel">Drive URL</label><input class="finput" id="ef-url" value="\${url}"></div>
      <div class="form-group"><label class="flabel">Subtitle</label><input class="finput" id="ef-subtitle" value="\${subtitle}"></div>
      <div class="form-group"><label class="flabel">Description</label><input class="finput" id="ef-desc" value="\${description}"></div>
      <div class="form-group"><label class="flabel">Access</label><select class="fselect" id="ef-access"><option value="free" \${access_level==='free'?'selected':''}>Free</option><option value="paid" \${access_level==='paid'?'selected':''}>Paid Gate</option><option value="admin_only" \${access_level==='admin_only'?'selected':''}>Admin Only</option></select></div>
    </div>
    <div class="form-actions"><button class="btn btn-gold" onclick="updateFile(\${id})">Save Changes</button><button class="btn btn-outline" onclick="closeModal()">Cancel</button></div>\`;
  showModal();
}

async function updateFile(id){
  const payload={label:document.getElementById('ef-label').value,icon:document.getElementById('ef-icon').value||'📁',drive_url:document.getElementById('ef-url').value,subtitle:document.getElementById('ef-subtitle').value,description:document.getElementById('ef-desc').value,access_level:document.getElementById('ef-access').value};
  try{
    const res=await fetch(AAPI+'/api/admin/files/'+id,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+getAdminToken()},body:JSON.stringify(payload)});
    const data=await res.json();
    if(data.success){closeModal();if(currentJobId){openJob(currentJobId,currentClientId);}else{editClient(currentClientId);}}
    else{document.getElementById('modal-msg').innerHTML='<div class="msg msg-error">'+(data.error||'Error')+'</div>';}
  }catch(e){console.error(e);}
}

async function deleteFile(id,clientId){
  if(!confirm('Delete this file card?')) return;
  try{
    await fetch(AAPI+'/api/admin/files/'+id,{method:'DELETE',headers:{'Authorization':'Bearer '+getAdminToken()}});
    if(currentJobId){openJob(currentJobId,clientId);}else{editClient(clientId);}
  }catch(e){console.error(e);}
}

function openAddReviewItemModal(clientId){
  document.getElementById('modal-content').innerHTML=\`
    <div class="modal-header"><div class="modal-title">Add Review Item</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="modal-msg"></div>
    <div class="form-grid">
      <div class="form-group span2"><label class="flabel">Label *</label><input class="finput" id="ri-label" placeholder="Highlight Reel"></div>
      <div class="form-group"><label class="flabel">Type</label><select class="fselect" id="ri-type"><option value="Video">Video</option><option value="Photo Set">Photo Set</option><option value="Design">Design</option><option value="Document">Document</option><option value="General">General</option></select></div>
      <div class="form-group span2"><label class="flabel">Description (optional)</label><input class="finput" id="ri-desc" placeholder="Context note for the client"></div>
    </div>
    <div class="form-actions"><button class="btn btn-gold" onclick="addReviewItem('\${clientId}')">Add Item</button><button class="btn btn-outline" onclick="closeModal()">Cancel</button></div>\`;
  showModal();
}

async function addReviewItem(clientId){
  const payload={label:document.getElementById('ri-label').value.trim(),type:document.getElementById('ri-type').value,description:document.getElementById('ri-desc').value.trim()};
  if(!payload.label){document.getElementById('modal-msg').innerHTML='<div class="msg msg-error">Label is required.</div>';return;}
  try{
    const res=await fetch(AAPI+'/api/admin/clients/'+clientId+'/review-items',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+getAdminToken()},body:JSON.stringify(payload)});
    const data=await res.json();
    if(data.success){closeModal();editClient(clientId);}
    else{document.getElementById('modal-msg').innerHTML='<div class="msg msg-error">'+(data.error||'Error')+'</div>';}
  }catch(e){console.error(e);}
}

async function deleteReviewItem(id,clientId){
  if(!confirm('Delete this review item?')) return;
  try{
    await fetch(AAPI+'/api/admin/review-items/'+id,{method:'DELETE',headers:{'Authorization':'Bearer '+getAdminToken()}});
    editClient(clientId);
  }catch(e){console.error(e);}
}

// ── JOBS ──
function openAddJobModal(clientId) {
  document.getElementById('modal-content').innerHTML = \`
    <div class="modal-header"><div class="modal-title">Add Job</div><button class="btn btn-outline btn-sm" onclick="closeModal()">✕</button></div>
    <div id="modal-msg"></div>
    <div class="form-grid">
      <div class="form-group span2"><label class="flabel">Job Title *</label><input class="finput" id="jb-title" placeholder="e.g. Wedding Highlight Film"></div>
      <div class="form-group span2"><label class="flabel">Description</label><textarea class="ftextarea" id="jb-desc" placeholder="Brief description of this job..." style="min-height:72px"></textarea></div>
      <div class="form-group"><label class="flabel">Phase</label><select class="fselect" id="jb-phase"><option value="in_progress">In Progress</option><option value="in_review">In Review</option><option value="complete">Complete</option></select></div>
      <div class="form-group"><label class="flabel">Internal Note</label><input class="finput" id="jb-note" placeholder="Admin-only note"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-gold" onclick="saveNewJob('\${clientId}')">Create Job</button>
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
    </div>\`;
  showModal();
}

function openEditJobModal(id, title, description, phase, adminNote) {
  document.getElementById('modal-content').innerHTML = \`
    <div class="modal-header"><div class="modal-title">Edit Job</div><button class="btn btn-outline btn-sm" onclick="closeModal()">✕</button></div>
    <div id="modal-msg"></div>
    <div class="form-grid">
      <div class="form-group span2"><label class="flabel">Job Title *</label><input class="finput" id="jb-title" value="\${title}"></div>
      <div class="form-group span2"><label class="flabel">Description</label><textarea class="ftextarea" id="jb-desc" style="min-height:72px">\${description}</textarea></div>
      <div class="form-group"><label class="flabel">Phase</label><select class="fselect" id="jb-phase"><option value="in_progress" \${phase==='in_progress'?'selected':''}>In Progress</option><option value="in_review" \${phase==='in_review'?'selected':''}>In Review</option><option value="complete" \${phase==='complete'?'selected':''}>Complete</option><option value="archived" \${phase==='archived'?'selected':''}>Archived (hidden from client)</option></select></div>
      <div class="form-group"><label class="flabel">Internal Note</label><input class="finput" id="jb-note" value="\${adminNote}"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-gold" onclick="updateJob(\${id})">Save Changes</button>
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
    </div>\`;
  showModal();
}

async function saveNewJob(clientId) {
  const title = document.getElementById('jb-title').value.trim();
  if (!title) { document.getElementById('modal-msg').innerHTML = '<div class="msg msg-error">Job title is required.</div>'; return; }
  const payload = { title, description: document.getElementById('jb-desc').value.trim(), phase: document.getElementById('jb-phase').value, admin_note: document.getElementById('jb-note').value.trim() };
  try {
    const res = await fetch(AAPI+'/api/admin/clients/'+clientId+'/jobs', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getAdminToken()}, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) { closeModal(); editClient(clientId); }
    else { document.getElementById('modal-msg').innerHTML = '<div class="msg msg-error">'+(data.error||'Error creating job')+'</div>'; }
  } catch(e) { document.getElementById('modal-msg').innerHTML = '<div class="msg msg-error">Connection error.</div>'; }
}

async function updateJob(id) {
  const title = document.getElementById('jb-title').value.trim();
  if (!title) { document.getElementById('modal-msg').innerHTML = '<div class="msg msg-error">Job title is required.</div>'; return; }
  const payload = { title, description: document.getElementById('jb-desc').value.trim(), phase: document.getElementById('jb-phase').value, admin_note: document.getElementById('jb-note').value.trim() };
  try {
    const res = await fetch(AAPI+'/api/admin/jobs/'+id, { method:'PUT', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getAdminToken()}, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) { closeModal(); editClient(currentClientId); }
    else { document.getElementById('modal-msg').innerHTML = '<div class="msg msg-error">'+(data.error||'Error saving job')+'</div>'; }
  } catch(e) { document.getElementById('modal-msg').innerHTML = '<div class="msg msg-error">Connection error.</div>'; }
}

async function deleteJob(id, clientId) {
  if (!confirm('Delete this job? This will also remove all its files and review items.')) return;
  try {
    await fetch(AAPI+'/api/admin/jobs/'+id, { method:'DELETE', headers:{'Authorization':'Bearer '+getAdminToken()} });
    editClient(clientId);
  } catch(e) { console.error(e); }
}

async function deleteClient(clientId, clientName) {
  if (!confirm('Permanently delete ' + clientName + '?\n\nThis will remove the client, all their jobs, files, review items, and submissions. This cannot be undone.')) return;
  try {
    const res = await fetch(AAPI+'/api/admin/clients/'+clientId, { method:'DELETE', headers:{'Authorization':'Bearer '+getAdminToken()} });
    const data = await res.json();
    if (data.success) {
      showView('clients');
    } else {
      alert('Error deleting client: ' + (data.error || 'Unknown error'));
    }
  } catch(e) { alert('Connection error. Please try again.'); }
}

// ── JOB-SCOPED FILE & REVIEW MODALS ──
function openAddJobFileModal(jobId, clientId) {
  document.getElementById('modal-content').innerHTML = \`
    <div class="modal-header"><div class="modal-title">Add File Card</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="modal-msg"></div>
    <div class="form-grid">
      <div class="form-group"><label class="flabel">Label *</label><input class="finput" id="mf-label" placeholder="Final Deliverables"></div>
      <div class="form-group"><label class="flabel">Icon (emoji)</label><input class="finput" id="mf-icon" placeholder="📁" maxlength="4"></div>
      <div class="form-group span2"><label class="flabel">Google Drive URL *</label><input class="finput" id="mf-url" placeholder="https://drive.google.com/..."></div>
      <div class="form-group"><label class="flabel">Subtitle</label><input class="finput" id="mf-subtitle" placeholder="LBMD Delivery Suite"></div>
      <div class="form-group"><label class="flabel">Description</label><input class="finput" id="mf-desc" placeholder="Export-ready files"></div>
      <div class="form-group"><label class="flabel">Access Level</label><select class="fselect" id="mf-access"><option value="free">Free (always visible)</option><option value="paid">Paid Gate (locked until paid)</option><option value="admin_only">Admin Only (hidden from client)</option></select></div>
    </div>
    <div class="form-actions"><button class="btn btn-gold" onclick="addJobFile(\${jobId},'\${clientId}')">Add File Card</button><button class="btn btn-outline" onclick="closeModal()">Cancel</button></div>\`;
  showModal();
}

async function addJobFile(jobId, clientId) {
  const payload = { label: document.getElementById('mf-label').value.trim(), icon: document.getElementById('mf-icon').value.trim()||'📁', drive_url: document.getElementById('mf-url').value.trim(), subtitle: document.getElementById('mf-subtitle').value.trim(), description: document.getElementById('mf-desc').value.trim(), access_level: document.getElementById('mf-access').value };
  if (!payload.label || !payload.drive_url) { document.getElementById('modal-msg').innerHTML='<div class="msg msg-error">Label and Drive URL are required.</div>'; return; }
  try {
    const res = await fetch(AAPI+'/api/admin/jobs/'+jobId+'/files', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getAdminToken()}, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) { closeModal(); openJob(jobId, clientId); }
    else { document.getElementById('modal-msg').innerHTML='<div class="msg msg-error">'+(data.error||'Error')+'</div>'; }
  } catch(e) { console.error(e); }
}

function openAddJobCategoryModal(jobId, clientId) {
  document.getElementById('modal-content').innerHTML = \`
    <div class="modal-header"><div class="modal-title">Add Deliverable Category</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="modal-msg"></div>
    <div class="form-grid">
      <div class="form-group span2"><label class="flabel">Category Name *</label><input class="finput" id="cat-label" placeholder="Highlight Reel"><div class="fhint">This becomes the tab label in the client's review section.</div></div>
      <div class="form-group span2"><label class="flabel">Google Drive Folder URL *</label><input class="finput" id="cat-url" placeholder="https://drive.google.com/drive/folders/..."><div class="fhint">All files in this folder will auto-load for review.</div></div>
    </div>
    <div class="form-actions"><button class="btn btn-gold" onclick="addJobCategory(\${jobId},'\${clientId}')">Add Category</button><button class="btn btn-outline" onclick="closeModal()">Cancel</button></div>\`;
  showModal();
}

async function addJobCategory(jobId, clientId) {
  const label = document.getElementById('cat-label').value.trim();
  const url = document.getElementById('cat-url').value.trim();
  if (!label || !url) { document.getElementById('modal-msg').innerHTML='<div class="msg msg-error">Category name and folder URL are required.</div>'; return; }
  try {
    const res = await fetch(AAPI+'/api/admin/jobs/'+jobId+'/files', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getAdminToken()}, body: JSON.stringify({ label, icon:'🗂', drive_url: url, subtitle:'', description:'', access_level:'review_folder' }) });
    const data = await res.json();
    if (data.success) { closeModal(); openJob(jobId, clientId); }
    else { document.getElementById('modal-msg').innerHTML='<div class="msg msg-error">'+(data.error||'Error')+'</div>'; }
  } catch(e) { console.error(e); }
}

function openAddJobReviewItemModal(jobId, clientId) {
  document.getElementById('modal-content').innerHTML = \`
    <div class="modal-header"><div class="modal-title">Add Review Item</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="modal-msg"></div>
    <div class="form-grid">
      <div class="form-group span2"><label class="flabel">Label *</label><input class="finput" id="ri-label" placeholder="Highlight Reel"></div>
      <div class="form-group"><label class="flabel">Type</label><select class="fselect" id="ri-type"><option value="Video">Video</option><option value="Photo Set">Photo Set</option><option value="Design">Design</option><option value="Document">Document</option><option value="General">General</option></select></div>
      <div class="form-group span2"><label class="flabel">Description (optional)</label><input class="finput" id="ri-desc" placeholder="Context note for the client"></div>
    </div>
    <div class="form-actions"><button class="btn btn-gold" onclick="addJobReviewItem(\${jobId},'\${clientId}')">Add Item</button><button class="btn btn-outline" onclick="closeModal()">Cancel</button></div>\`;
  showModal();
}

async function addJobReviewItem(jobId, clientId) {
  const payload = { label: document.getElementById('ri-label').value.trim(), type: document.getElementById('ri-type').value, description: document.getElementById('ri-desc').value.trim() };
  if (!payload.label) { document.getElementById('modal-msg').innerHTML='<div class="msg msg-error">Label is required.</div>'; return; }
  try {
    const res = await fetch(AAPI+'/api/admin/jobs/'+jobId+'/review-items', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getAdminToken()}, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) { closeModal(); openJob(jobId, clientId); }
    else { document.getElementById('modal-msg').innerHTML='<div class="msg msg-error">'+(data.error||'Error')+'</div>'; }
  } catch(e) { console.error(e); }
}

async function deleteJobFile(id, jobId, clientId) {
  if (!confirm('Delete this file card?')) return;
  try {
    await fetch(AAPI+'/api/admin/files/'+id, { method:'DELETE', headers:{'Authorization':'Bearer '+getAdminToken()} });
    openJob(jobId, clientId);
  } catch(e) { console.error(e); }
}

async function deleteJobReviewItem(id, jobId, clientId) {
  if (!confirm('Delete this review item?')) return;
  try {
    await fetch(AAPI+'/api/admin/review-items/'+id, { method:'DELETE', headers:{'Authorization':'Bearer '+getAdminToken()} });
    openJob(jobId, clientId);
  } catch(e) { console.error(e); }
}

function showModal(){document.getElementById('modal-overlay').classList.remove('hidden');}
function closeModal(){document.getElementById('modal-overlay').classList.add('hidden');}
function esc(s){return String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// ── AUTO-LOGIN ──
(async function(){
  const t=getAdminToken();
  if(t){
    try{
      const res=await fetch(AAPI+'/api/admin/clients',{headers:{'Authorization':'Bearer '+t}});
      if(res.ok){enterAdmin();return;}
    }catch(e){}
    clearAdminToken();
  }
})();
</script>
</body>
</html>`;

// ── HELPERS ──
async function hashPassword(password) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(password + SALT));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
}

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders() }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
}

function html(content) {
  return new Response(content, { headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' } });
}

async function getClientSession(token, env) {
  if (!token) return null;
  const val = await env.SESSIONS.get('client_' + token);
  return val ? JSON.parse(val) : null;
}

async function getAdminSession(token, env) {
  if (!token) return null;
  const val = await env.SESSIONS.get('admin_' + token);
  return !!val;
}

function extractToken(request) {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

// ── MAIN ROUTER ──
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // API routes
    if (path.startsWith('/api/')) {
      return handleAPI(request, env, path, method);
    }

    // Admin panel
    if (path === '/admin' || path === '/admin/') {
      return html(ADMIN_HTML);
    }

    // Root → admin
    if (path === '/' || path === '') {
      return Response.redirect(url.origin + '/admin', 302);
    }

    // Client portal (any slug)
    return html(PORTAL_HTML);
  }
};

// ── API HANDLER ──
async function handleAPI(request, env, path, method) {
  try {
    // ── CLIENT AUTH ──
    if (path === '/api/auth/login' && method === 'POST') {
      const { clientId, password } = await request.json();
      if (!clientId || !password) return json({ error: 'Missing fields.' }, 400);
      const client = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(clientId).first();
      if (!client) return json({ error: 'Incorrect access code.' }, 401);
      const hash = await hashPassword(password);
      if (hash !== client.password_hash) return json({ error: 'Incorrect access code.' }, 401);
      const token = generateToken();
      await env.SESSIONS.put('client_' + token, JSON.stringify({ clientId, name: client.name }), { expirationTtl: 28800 }); // 8h
      const portal = await buildPortalData(client, env);
      return json({ token, portal });
    }

    // ── GET PORTAL DATA ──
    if (path.startsWith('/api/portal/') && method === 'GET') {
      const clientId = path.replace('/api/portal/', '');
      const token = extractToken(request);
      const session = await getClientSession(token, env);
      if (!session || session.clientId !== clientId) return json({ error: 'Unauthorized.' }, 401);
      const client = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(clientId).first();
      if (!client) return json({ error: 'Not found.' }, 404);
      const portal = await buildPortalData(client, env);
      return json(portal);
    }

    // ── SUBMIT REVIEW ──
    if (path === '/api/review/submit' && method === 'POST') {
      const token = extractToken(request);
      const body = await request.json();
      const { clientId, jobId, responses } = body;
      const session = await getClientSession(token, env);
      if (!session || session.clientId !== clientId) return json({ error: 'Unauthorized.' }, 401);
      // Delete old responses — try job-scoped first, fall back to client-scoped if job_id column missing
      try {
        if (jobId) {
          await env.DB.prepare('DELETE FROM review_responses WHERE client_id = ? AND job_id = ?').bind(clientId, jobId).run();
        } else {
          await env.DB.prepare('DELETE FROM review_responses WHERE client_id = ? AND job_id IS NULL').bind(clientId).run();
        }
      } catch(e) {
        // job_id column may not exist yet — delete all responses for this client
        await env.DB.prepare('DELETE FROM review_responses WHERE client_id = ?').bind(clientId).run();
      }
      // Insert new responses — try full schema first, fall back to original schema if columns missing
      for (const r of responses) {
        try {
          await env.DB.prepare(
            'INSERT INTO review_responses (client_id, job_id, item_id, rating, note, session_id, label) VALUES (?,?,?,?,?,?,?)'
          ).bind(clientId, jobId || null, r.itemId, r.rating, r.note || '', token, r.label || '').run();
        } catch(e) {
          // Fallback: original schema without job_id / label columns
          await env.DB.prepare(
            'INSERT INTO review_responses (client_id, item_id, rating, note, session_id) VALUES (?,?,?,?,?)'
          ).bind(clientId, r.itemId, r.rating, r.note || '', token).run();
        }
      }
      return json({ success: true });
    }

    // ── BLACKSUITE FILE PROXY (client-scoped) ──
    // Streams a bs_files row (or legacy client_files fallback) only if the
    // authenticated client owns it. Accepts Authorization: Bearer <token>
    // OR ?t=<token> query param (required for <video src> tags).
    {
      const bsStreamMatch   = path.match(/^\/api\/bs\/stream\/(\d+)$/);
      const bsDownloadMatch = path.match(/^\/api\/bs\/download\/(\d+)$/);
      if (method === 'GET' && (bsStreamMatch || bsDownloadMatch)) {
        const fileId     = Number((bsStreamMatch || bsDownloadMatch)[1]);
        const isDownload = !!bsDownloadMatch;

        const url = new URL(request.url);
        const token = extractToken(request) || url.searchParams.get('t') || '';
        const session = await getClientSession(token, env);
        if (!session) return json({ error: 'Unauthorized.' }, 401);
        const clientId = session.clientId;

        // Ensure BlackSuite tables exist (portal-side cold start may precede admin).
        try { await ensureBlackSuiteSchema(env.DB); } catch (_) {}

        // 1) bs_files direct ownership
        let row = await env.DB.prepare(
          `SELECT id, storage_backend, storage_key, label, mime_type, owner_type, owner_id
             FROM bs_files WHERE id = ?`,
        ).bind(fileId).first().catch(() => null);

        let allowed = false;
        if (row) {
          if (row.owner_type === 'client' && String(row.owner_id) === String(clientId)) {
            allowed = true;
          } else if (row.owner_type === 'delivery') {
            const d = await env.DB.prepare(
              'SELECT client_id FROM bs_deliveries WHERE id = ?',
            ).bind(row.owner_id).first().catch(() => null);
            if (d && String(d.client_id) === String(clientId)) allowed = true;
          }
        } else {
          // 2) Legacy client_files fallback
          const legacy = await env.DB.prepare(
            'SELECT id, client_id, label, subtitle, drive_url FROM client_files WHERE id = ?',
          ).bind(fileId).first().catch(() => null);
          if (legacy && String(legacy.client_id) === String(clientId)) {
            const synth = Storage.legacyDriveFileFromUrl(legacy);
            if (synth) { row = synth; allowed = true; }
          }
        }
        if (!row || !allowed) return json({ error: 'Not found.' }, 404);

        const range       = request.headers.get('range') || undefined;
        const ifNoneMatch = request.headers.get('if-none-match') || undefined;
        const storage     = new Storage(env);
        const { body, status, headers } = await storage.get(row.storage_key, { range, ifNoneMatch });

        if (row.mime_type && !headers.get('content-type')) {
          headers.set('content-type', row.mime_type);
        }
        if (isDownload) {
          const safeLabel = (row.label || `file-${fileId}`).replace(/["\\\r\n]/g, '_');
          headers.set('content-disposition', `attachment; filename="${safeLabel}"`);
        } else if (!headers.get('cache-control')) {
          headers.set('cache-control', 'private, max-age=60');
        }
        return new Response(body, { status, headers });
      }
    }

    // ── ZIP DOWNLOAD (stub — Phase 2) ──
    {
      const zipMatch = path.match(/^\/api\/bs\/delivery\/(\d+)\/zip$/);
      if (method === 'GET' && zipMatch) {
        return json({ error: 'ZIP download not implemented in Phase 1.' }, 501);
      }
    }

    // ── PASSWORD RESET REQUEST ──
    if (path === '/api/auth/reset-request' && method === 'POST') {
      const { clientId, email } = await request.json();
      if (!clientId || !email) return json({ error: 'Missing fields.' }, 400);
      const client = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(clientId).first();
      if (!client || !client.email || client.email.toLowerCase() !== email.toLowerCase()) {
        return json({ error: 'No account found with that email address.' }, 404);
      }
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      await env.SESSIONS.put('reset_' + clientId, otp, { expirationTtl: 3600 });
      // Email OTP via Apps Script
      try {
        const scriptUrl = REVIEW_SCRIPT_URL;
        await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ type: 'otp', to: email, clientName: client.name, code: otp })
        });
      } catch(e) {}
      return json({ success: true });
    }

    // ── PASSWORD RESET VERIFY ──
    if (path === '/api/auth/reset-verify' && method === 'POST') {
      const { clientId, otp, newPassword } = await request.json();
      if (!clientId || !otp || !newPassword) return json({ error: 'Missing fields.' }, 400);
      const stored = await env.SESSIONS.get('reset_' + clientId);
      if (!stored || stored !== String(otp)) return json({ error: 'Invalid or expired code.' }, 400);
      const hash = await hashPassword(newPassword);
      await env.DB.prepare('UPDATE clients SET password_hash=? WHERE id=?').bind(hash, clientId).run();
      await env.SESSIONS.delete('reset_' + clientId);
      return json({ success: true });
    }

    // ── ADMIN PASSWORD RESET ──
    if (path === '/api/admin-reset-request' && method === 'POST') {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      await env.SESSIONS.put('admin_reset_otp', otp, { expirationTtl: 3600 }); // 1 hour
      const adminEmails = ['bruce@myluckyblackmedia.com', 'myluckyblack@gmail.com'];
      for (const email of adminEmails) {
        await sendPortalEmail('reset', email, 'Bruce', 'Admin Portal', 'https://portal.myluckyblackmedia.com/admin', otp);
      }
      return json({ success: true });
    }

    if (path === '/api/admin-reset-verify' && method === 'POST') {
      const { otp, newPassword } = await request.json();
      if (!otp || !newPassword) return json({ error: 'Missing fields.' }, 400);
      const stored = await env.SESSIONS.get('admin_reset_otp');
      if (!stored || stored !== String(otp)) return json({ error: 'Invalid or expired code. Request a new one.' }, 400);
      const hash = await hashPassword(newPassword);
      await env.SESSIONS.put('admin_pw_hash', hash); // No TTL — persists permanently
      await env.SESSIONS.delete('admin_reset_otp');
      return json({ success: true });
    }

    // ── ADMIN LOGIN ──
    if (path === '/api/admin/login' && method === 'POST') {
      const { password } = await request.json();
      const hash = await hashPassword(password);
      // Check KV first for runtime-reset password, fall back to hardcoded constant
      const kvHash = await env.SESSIONS.get('admin_pw_hash').catch(() => null);
      const expectedHash = kvHash || ADMIN_PW_HASH;
      if (hash !== expectedHash) return json({ error: 'Incorrect password.' }, 401);
      const token = generateToken();
      await env.SESSIONS.put('admin_' + token, '1', { expirationTtl: 86400 }); // 24h
      return json({ token });
    }

    // Admin auth check for all /api/admin/* routes
    if (path.startsWith('/api/admin/')) {
      const token = extractToken(request);
      const isAdmin = await getAdminSession(token, env);
      if (!isAdmin) return json({ error: 'Admin access required.' }, 401);
      return handleAdminAPI(request, env, path, method);
    }

    return json({ error: 'Not found.' }, 404);
  } catch (err) {
    return json({ error: err.message || 'Server error.' }, 500);
  }
}

// ── ADMIN API ──
async function handleAdminAPI(request, env, path, method) {
  // GET /api/admin/clients
  if (path === '/api/admin/clients' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
    return json({ clients: results });
  }

  // POST /api/admin/clients
  if (path === '/api/admin/clients' && method === 'POST') {
    const b = await request.json();
    if (!b.id || !b.name || !b.password) return json({ error: 'id, name, and password required.' }, 400);
    const existing = await env.DB.prepare('SELECT id FROM clients WHERE id = ?').bind(b.id).first();
    if (existing) return json({ error: 'A portal with this slug already exists.' }, 409);
    const hash = await hashPassword(b.password);
    await env.DB.prepare(
      'INSERT INTO clients (id,name,event,password_hash,status,expiry_date,admin_note,phase,service_type,email) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).bind(b.id, b.name, b.event||'', hash, b.status||'active', b.expiry_date||null, b.admin_note||'', b.phase||'in_progress', b.service_type||'event', b.email||'').run();
    // Auto-send welcome email if client email was provided
    if (b.email) {
      const portalUrl = 'https://portal.myluckyblackmedia.com/' + b.id;
      await sendPortalEmail('welcome', b.email, b.name, b.event || b.name, portalUrl, b.password);
    }
    return json({ success: true, id: b.id, password: b.password });
  }

  // GET /api/admin/clients/:id
  const clientMatch = path.match(/^\/api\/admin\/clients\/([^\/]+)$/);
  if (clientMatch && method === 'GET') {
    const client = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(clientMatch[1]).first();
    if (!client) return json({ error: 'Not found.' }, 404);
    return json(client);
  }

  // POST /api/admin/clients/:id/send-portal-email
  const sendEmailMatch = path.match(/^\/api\/admin\/clients\/([^\/]+)\/send-portal-email$/);
  if (sendEmailMatch && method === 'POST') {
    const client = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(sendEmailMatch[1]).first();
    if (!client) return json({ error: 'Client not found.' }, 404);
    if (!client.email) return json({ error: 'No email address on file for this client.' }, 400);
    const portalUrl = 'https://portal.myluckyblackmedia.com/' + client.id;
    await sendPortalEmail('portal-access', client.email, client.name, client.event || client.name, portalUrl);
    return json({ success: true });
  }

  // PUT /api/admin/clients/:id
  if (clientMatch && method === 'PUT') {
    const id = clientMatch[1];
    const b = await request.json();
    // Fetch existing record to detect email change
    const existing = await env.DB.prepare('SELECT email, name, event FROM clients WHERE id = ?').bind(id).first();
    await env.DB.prepare(
      'UPDATE clients SET name=?,event=?,status=?,expiry_date=?,admin_note=?,phase=?,service_type=?,email=? WHERE id=?'
    ).bind(b.name, b.event||'', b.status, b.expiry_date||null, b.admin_note||'', b.phase, b.service_type||'event', b.email||'', id).run();
    const portalUrl = 'https://portal.myluckyblackmedia.com/' + id;
    if (b.newPassword) {
      const hash = await hashPassword(b.newPassword);
      await env.DB.prepare('UPDATE clients SET password_hash=? WHERE id=?').bind(hash, id).run();
      // Send new access code email if email is on file
      if (b.email) {
        await sendPortalEmail('welcome', b.email, b.name, b.event || b.name, portalUrl, b.newPassword);
      }
    } else if (b.email && existing && b.email.toLowerCase() !== (existing.email||'').toLowerCase()) {
      // Email address changed — send portal access email to new address
      await sendPortalEmail('portal-access', b.email, b.name, b.event || b.name, portalUrl);
    }
    // Read back updated record to confirm the write applied
    const updated = await env.DB.prepare('SELECT status, name, event, phase FROM clients WHERE id = ?').bind(id).first();
    return json({ success: true, status: updated ? updated.status : b.status, name: updated ? updated.name : b.name, event: updated ? updated.event : b.event, phase: updated ? updated.phase : b.phase });
  }

  // DELETE /api/admin/clients/:id — cascade deletes everything
  if (clientMatch && method === 'DELETE') {
    const id = clientMatch[1];
    await env.DB.prepare('DELETE FROM review_responses WHERE client_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM review_items WHERE client_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM client_files WHERE client_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM jobs WHERE client_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM clients WHERE id = ?').bind(id).run();
    return json({ success: true });
  }

  // GET /api/admin/clients/:id/files
  const filesMatch = path.match(/^\/api\/admin\/clients\/([^\/]+)\/files$/);
  if (filesMatch && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM client_files WHERE client_id = ? ORDER BY sort_order').bind(filesMatch[1]).all();
    return json({ files: results });
  }

  // POST /api/admin/clients/:id/files
  if (filesMatch && method === 'POST') {
    const b = await request.json();
    const { results: existing } = await env.DB.prepare('SELECT COUNT(*) as c FROM client_files WHERE client_id = ?').bind(filesMatch[1]).all();
    const order = (existing[0]?.c || 0) + 1;
    await env.DB.prepare(
      'INSERT INTO client_files (client_id,label,subtitle,description,drive_url,icon,access_level,sort_order) VALUES (?,?,?,?,?,?,?,?)'
    ).bind(filesMatch[1], b.label, b.subtitle||'', b.description||'', b.drive_url||'#', b.icon||'📁', b.access_level||'free', order).run();
    return json({ success: true });
  }

  // PUT /api/admin/files/:id
  const fileEditMatch = path.match(/^\/api\/admin\/files\/(\d+)$/);
  if (fileEditMatch && method === 'PUT') {
    const b = await request.json();
    await env.DB.prepare(
      'UPDATE client_files SET label=?,subtitle=?,description=?,drive_url=?,icon=?,access_level=? WHERE id=?'
    ).bind(b.label, b.subtitle||'', b.description||'', b.drive_url, b.icon||'📁', b.access_level||'free', parseInt(fileEditMatch[1])).run();
    return json({ success: true });
  }

  // DELETE /api/admin/files/:id
  if (fileEditMatch && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM client_files WHERE id=?').bind(parseInt(fileEditMatch[1])).run();
    return json({ success: true });
  }

  // GET /api/admin/clients/:id/review-items
  const riMatch = path.match(/^\/api\/admin\/clients\/([^\/]+)\/review-items$/);
  if (riMatch && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM review_items WHERE client_id = ? ORDER BY sort_order').bind(riMatch[1]).all();
    return json({ items: results });
  }

  // POST /api/admin/clients/:id/review-items
  if (riMatch && method === 'POST') {
    const b = await request.json();
    const { results: existing } = await env.DB.prepare('SELECT COUNT(*) as c FROM review_items WHERE client_id = ?').bind(riMatch[1]).all();
    const order = (existing[0]?.c || 0) + 1;
    await env.DB.prepare(
      'INSERT INTO review_items (client_id,label,type,description,sort_order) VALUES (?,?,?,?,?)'
    ).bind(riMatch[1], b.label, b.type||'General', b.description||'', order).run();
    return json({ success: true });
  }

  // DELETE /api/admin/review-items/:id
  const riDelMatch = path.match(/^\/api\/admin\/review-items\/(\d+)$/);
  if (riDelMatch && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM review_items WHERE id=?').bind(parseInt(riDelMatch[1])).run();
    return json({ success: true });
  }

  // GET /api/admin/clients/:id/reviews
  const reviewsMatch = path.match(/^\/api\/admin\/clients\/([^\/]+)\/reviews$/);
  if (reviewsMatch && method === 'GET') {
    const { results: items } = await env.DB.prepare('SELECT * FROM review_items WHERE client_id = ? ORDER BY sort_order').bind(reviewsMatch[1]).all();
    const { results: reviews } = await env.DB.prepare('SELECT * FROM review_responses WHERE client_id = ? ORDER BY submitted_at DESC').bind(reviewsMatch[1]).all();
    return json({ items, reviews });
  }

  // GET /api/admin/clients/:id/jobs
  const jobsMatch = path.match(/^\/api\/admin\/clients\/([^\/]+)\/jobs$/);
  if (jobsMatch && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM jobs WHERE client_id = ? ORDER BY sort_order, created_at').bind(jobsMatch[1]).all();
    return json({ jobs: results });
  }

  // POST /api/admin/clients/:id/jobs
  if (jobsMatch && method === 'POST') {
    const b = await request.json();
    if (!b.title) return json({ error: 'Title is required.' }, 400);
    const { results: existing } = await env.DB.prepare('SELECT COUNT(*) as c FROM jobs WHERE client_id = ?').bind(jobsMatch[1]).all();
    const order = (existing[0]?.c || 0) + 1;
    await env.DB.prepare(
      'INSERT INTO jobs (client_id, title, description, phase, admin_note, sort_order) VALUES (?,?,?,?,?,?)'
    ).bind(jobsMatch[1], b.title, b.description||'', b.phase||'in_progress', b.admin_note||'', order).run();
    return json({ success: true });
  }

  // GET /api/admin/jobs/:id (single job)
  const jobEditMatch = path.match(/^\/api\/admin\/jobs\/(\d+)$/);
  if (jobEditMatch && method === 'GET') {
    const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(parseInt(jobEditMatch[1])).first();
    if (!job) return json({ error: 'Not found.' }, 404);
    return json(job);
  }

  // PUT /api/admin/jobs/:id
  if (jobEditMatch && method === 'PUT') {
    const b = await request.json();
    if (!b.title) return json({ error: 'Title is required.' }, 400);
    await env.DB.prepare(
      'UPDATE jobs SET title=?, description=?, phase=?, admin_note=? WHERE id=?'
    ).bind(b.title, b.description||'', b.phase||'in_progress', b.admin_note||'', parseInt(jobEditMatch[1])).run();
    return json({ success: true });
  }

  // DELETE /api/admin/jobs/:id
  if (jobEditMatch && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM jobs WHERE id=?').bind(parseInt(jobEditMatch[1])).run();
    return json({ success: true });
  }

  // GET /api/admin/jobs/:id/files
  const jobFilesMatch = path.match(/^\/api\/admin\/jobs\/(\d+)\/files$/);
  if (jobFilesMatch && method === 'GET') {
    const { results } = await env.DB.prepare(
      "SELECT * FROM client_files WHERE job_id = ? ORDER BY sort_order"
    ).bind(parseInt(jobFilesMatch[1])).all();
    return json({ files: results });
  }

  // POST /api/admin/jobs/:id/files
  if (jobFilesMatch && method === 'POST') {
    const b = await request.json();
    const job = await env.DB.prepare('SELECT client_id FROM jobs WHERE id = ?').bind(parseInt(jobFilesMatch[1])).first();
    if (!job) return json({ error: 'Job not found.' }, 404);
    const { results: existing } = await env.DB.prepare('SELECT COUNT(*) as c FROM client_files WHERE job_id = ?').bind(parseInt(jobFilesMatch[1])).all();
    const order = (existing[0]?.c || 0) + 1;
    await env.DB.prepare(
      'INSERT INTO client_files (client_id, job_id, label, subtitle, description, drive_url, icon, access_level, sort_order) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(job.client_id, parseInt(jobFilesMatch[1]), b.label, b.subtitle||'', b.description||'', b.drive_url||'#', b.icon||'📁', b.access_level||'free', order).run();
    return json({ success: true });
  }

  // GET /api/admin/jobs/:id/review-items
  const jobRiMatch = path.match(/^\/api\/admin\/jobs\/(\d+)\/review-items$/);
  if (jobRiMatch && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM review_items WHERE job_id = ? ORDER BY sort_order').bind(parseInt(jobRiMatch[1])).all();
    return json({ items: results });
  }

  // POST /api/admin/jobs/:id/review-items
  if (jobRiMatch && method === 'POST') {
    const b = await request.json();
    const job = await env.DB.prepare('SELECT client_id FROM jobs WHERE id = ?').bind(parseInt(jobRiMatch[1])).first();
    if (!job) return json({ error: 'Job not found.' }, 404);
    const { results: existing } = await env.DB.prepare('SELECT COUNT(*) as c FROM review_items WHERE job_id = ?').bind(parseInt(jobRiMatch[1])).all();
    const order = (existing[0]?.c || 0) + 1;
    await env.DB.prepare(
      'INSERT INTO review_items (client_id, job_id, label, type, description, sort_order) VALUES (?,?,?,?,?,?)'
    ).bind(job.client_id, parseInt(jobRiMatch[1]), b.label, b.type||'General', b.description||'', order).run();
    return json({ success: true });
  }

  // GET /api/admin/jobs/:id/reviews
  const jobReviewsMatch = path.match(/^\/api\/admin\/jobs\/(\d+)\/reviews$/);
  if (jobReviewsMatch && method === 'GET') {
    const jobId = parseInt(jobReviewsMatch[1]);
    const { results: items } = await env.DB.prepare('SELECT * FROM review_items WHERE job_id = ? ORDER BY sort_order').bind(jobId).all();
    const { results: reviews } = await env.DB.prepare('SELECT * FROM review_responses WHERE job_id = ? ORDER BY submitted_at DESC').bind(jobId).all();
    return json({ items, reviews });
  }

  return json({ error: 'Not found.' }, 404);
}

// ── BUILD PORTAL DATA ──
// ── PORTAL EMAIL HELPER ──
async function sendPortalEmail(type, to, clientName, projectTitle, portalUrl, accessCode) {
  if (!to) return;
  try {
    const payload = { type, to, clientName, projectTitle, portalUrl };
    if (accessCode) payload.accessCode = accessCode;
    await fetch(REVIEW_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
  } catch(e) { /* email is non-critical */ }
}

async function buildPortalData(client, env) {
  // Fetch jobs
  const { results: jobs } = await env.DB.prepare(
    "SELECT * FROM jobs WHERE client_id = ? AND (phase IS NULL OR phase != 'archived') ORDER BY sort_order, created_at"
  ).bind(client.id).all();

  // Client-level files and review_items (no job_id) — for legacy clients and as fallback
  // when a job exists but has no files/review_items assigned to it yet
  const { results: files } = await env.DB.prepare(
    "SELECT * FROM client_files WHERE client_id = ? AND job_id IS NULL AND access_level != 'admin_only' ORDER BY sort_order"
  ).bind(client.id).all();
  const { results: reviewItems } = await env.DB.prepare(
    'SELECT * FROM review_items WHERE client_id = ? AND job_id IS NULL ORDER BY sort_order'
  ).bind(client.id).all();

  // Fetch files and review_items for each job.
  // Files: fall back to client-level if job has none. Always ensure review_folder
  // files are available — if the job's own files have none, append client-level
  // review_folder files so Drive loading is never silently blocked.
  // review_items: NO fallback — only use job-scoped items so that client-level
  // manual review_items don't accidentally block Drive folder loading for jobs.
  const clientReviewFolders = files.filter(f => f.access_level === 'review_folder');
  const jobsWithData = [];
  for (const job of jobs) {
    const { results: jobFiles } = await env.DB.prepare(
      "SELECT * FROM client_files WHERE job_id = ? AND access_level != 'admin_only' ORDER BY sort_order"
    ).bind(job.id).all();
    const { results: jobReviewItems } = await env.DB.prepare(
      'SELECT * FROM review_items WHERE job_id = ? ORDER BY sort_order'
    ).bind(job.id).all();

    let portalFiles;
    if (jobFiles.length === 0) {
      // No job-scoped files at all — use client-level files as full fallback
      portalFiles = files;
    } else {
      // Job has its own files; make sure review_folder entries are present too.
      // If the job files don't include any review_folders, append the client-level ones.
      const jobHasReviewFolders = jobFiles.some(f => f.access_level === 'review_folder');
      portalFiles = jobHasReviewFolders ? jobFiles : [...jobFiles, ...clientReviewFolders];
    }

    jobsWithData.push({
      ...job,
      files: portalFiles,
      review_items: jobReviewItems   // No fallback — avoids blocking Drive loading
    });
  }

  return {
    id: client.id,
    name: client.name,
    event: client.event,
    status: client.status,
    phase: client.phase,
    expiry_date: client.expiry_date,
    admin_note: client.admin_note,
    service_type: client.service_type,
    jobs: jobsWithData,
    files,
    review_items: reviewItems
  };
}
