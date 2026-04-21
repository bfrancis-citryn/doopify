import Link from 'next/link';
import { getStorefrontProducts } from '../server/services/product.service';

export const metadata = {
  title: 'Doopify — Commerce, Refined',
  description: 'Premium products, delivered.',
};

export default async function LandingPage() {
  let featured = [];
  try {
    const result = await getStorefrontProducts({ pageSize: 3 });
    featured = result.products || [];
  } catch {}

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .landing {
          background: #080808;
          color: #f2ede4;
          min-height: 100vh;
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Nav ── */
        .nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 48px;
          background: linear-gradient(to bottom, rgba(8,8,8,0.95), transparent);
        }
        .nav-logo {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px;
          font-weight: 500;
          letter-spacing: 0.12em;
          color: #f2ede4;
          text-decoration: none;
          text-transform: uppercase;
        }
        .nav-links {
          display: flex;
          gap: 36px;
          list-style: none;
        }
        .nav-links a {
          color: #b8ad9e;
          text-decoration: none;
          font-size: 13px;
          font-weight: 400;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          transition: color 0.2s;
        }
        .nav-links a:hover { color: #f2ede4; }

        /* ── Hero ── */
        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 120px 48px 80px;
          position: relative;
          overflow: hidden;
        }
        .hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 50% 60%, rgba(201,168,108,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 20% 20%, rgba(201,168,108,0.04) 0%, transparent 60%);
          pointer-events: none;
        }
        .hero-eyebrow {
          font-size: 11px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: #c9a86c;
          margin-bottom: 28px;
          font-weight: 400;
        }
        .hero-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(64px, 10vw, 140px);
          font-weight: 300;
          line-height: 0.9;
          letter-spacing: -0.02em;
          color: #f2ede4;
          margin-bottom: 32px;
        }
        .hero-title em {
          font-style: italic;
          color: #c9a86c;
        }
        .hero-sub {
          font-size: 16px;
          font-weight: 300;
          color: #8a8070;
          max-width: 420px;
          line-height: 1.7;
          margin-bottom: 52px;
        }
        .hero-cta {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: #c9a86c;
          color: #080808;
          text-decoration: none;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          padding: 16px 36px;
          transition: background 0.2s, transform 0.2s;
        }
        .hero-cta:hover { background: #dbb97e; transform: translateY(-1px); }
        .hero-scroll {
          position: absolute;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: #4a4540;
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }
        .scroll-line {
          width: 1px;
          height: 40px;
          background: linear-gradient(to bottom, #4a4540, transparent);
        }

        /* ── Featured ── */
        .featured {
          padding: 120px 48px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .section-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 64px;
          border-top: 1px solid #1e1c19;
          padding-top: 32px;
        }
        .section-label {
          font-size: 11px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: #4a4540;
        }
        .section-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 48px;
          font-weight: 300;
          color: #f2ede4;
        }
        .section-link {
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c9a86c;
          text-decoration: none;
          border-bottom: 1px solid currentColor;
          padding-bottom: 2px;
        }

        .product-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
        }
        .product-card {
          display: block;
          text-decoration: none;
          color: inherit;
          background: #0f0e0c;
          overflow: hidden;
          position: relative;
          group: true;
        }
        .product-card:hover .card-img-inner { transform: scale(1.04); }
        .card-img {
          aspect-ratio: 3/4;
          overflow: hidden;
          background: #161410;
          position: relative;
        }
        .card-img-inner {
          width: 100%;
          height: 100%;
          transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .card-img img { width: 100%; height: 100%; object-fit: cover; }
        .card-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #2a2820;
        }
        .placeholder-icon { font-size: 48px; opacity: 0.4; }
        .card-body { padding: 24px 20px 28px; }
        .card-vendor {
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #4a4540;
          margin-bottom: 8px;
        }
        .card-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px;
          font-weight: 400;
          color: #f2ede4;
          margin-bottom: 12px;
          line-height: 1.2;
        }
        .card-price {
          font-size: 14px;
          font-weight: 300;
          color: #c9a86c;
        }

        /* ── Strip ── */
        .strip {
          border-top: 1px solid #1e1c19;
          border-bottom: 1px solid #1e1c19;
          padding: 20px 0;
          overflow: hidden;
          margin: 0 48px 120px;
        }
        .strip-inner {
          display: flex;
          gap: 48px;
          animation: marquee 20s linear infinite;
          width: max-content;
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .strip-item {
          font-size: 11px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: #2e2b26;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .strip-dot { width: 3px; height: 3px; background: #c9a86c; border-radius: 50%; }

        /* ── Footer ── */
        .footer {
          border-top: 1px solid #1e1c19;
          padding: 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .footer-brand {
          font-family: 'Cormorant Garamond', serif;
          font-size: 18px;
          font-weight: 400;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #2e2b26;
        }
        .footer-copy {
          font-size: 12px;
          color: #2e2b26;
          font-weight: 300;
        }

        @media (max-width: 900px) {
          .nav { padding: 20px 24px; }
          .hero { padding: 100px 24px 80px; }
          .featured { padding: 80px 24px; }
          .product-grid { grid-template-columns: repeat(2, 1fr); }
          .strip { margin: 0 24px 80px; }
          .footer { padding: 32px 24px; flex-direction: column; gap: 16px; text-align: center; }
        }
        @media (max-width: 600px) {
          .product-grid { grid-template-columns: 1fr; }
          .section-header { flex-direction: column; gap: 16px; }
        }
      `}</style>

      <div className="landing">
        <nav className="nav">
          <a className="nav-logo" href="/">Doopify</a>
          <ul className="nav-links">
            <li><a href="/shop">Shop</a></li>
            <li><a href="/shop">Collections</a></li>
            <li><a href="/shop">About</a></li>
          </ul>
        </nav>

        <section className="hero">
          <p className="hero-eyebrow">New Collection — 2026</p>
          <h1 className="hero-title">
            Commerce,<br /><em>Refined.</em>
          </h1>
          <p className="hero-sub">
            Curated products built for people who care about the details.
          </p>
          <Link className="hero-cta" href="/shop">
            Explore the collection
            <span>→</span>
          </Link>
          <div className="hero-scroll">
            <div className="scroll-line" />
            Scroll
          </div>
        </section>

        <div className="strip">
          <div className="strip-inner">
            {[...Array(8)].map((_, i) => (
              <span className="strip-item" key={i}>
                Free shipping over $100
                <span className="strip-dot" />
                Premium materials
                <span className="strip-dot" />
                30-day returns
                <span className="strip-dot" />
                Worldwide delivery
                <span className="strip-dot" />
              </span>
            ))}
          </div>
        </div>

        <section className="featured">
          <div className="section-header">
            <div>
              <p className="section-label">Handpicked for you</p>
              <h2 className="section-title">Featured Products</h2>
            </div>
            <Link className="section-link" href="/shop">View all</Link>
          </div>

          <div className="product-grid">
            {featured.map(product => {
              const image = product.media?.[0]?.asset?.url;
              const price = product.variants?.[0]?.price;
              return (
                <Link className="product-card" href={`/shop/${product.handle}`} key={product.id}>
                  <div className="card-img">
                    <div className="card-img-inner">
                      {image ? (
                        <img alt={product.title} src={image} />
                      ) : (
                        <div className="card-placeholder">
                          <span className="placeholder-icon">◻</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="card-body">
                    {product.vendor && <p className="card-vendor">{product.vendor}</p>}
                    <h3 className="card-title">{product.title}</h3>
                    {price != null && (
                      <p className="card-price">${Number(price).toFixed(2)}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <footer className="footer">
          <span className="footer-brand">Doopify</span>
          <span className="footer-copy">© 2026 Doopify. All rights reserved.</span>
        </footer>
      </div>
    </>
  );
}
