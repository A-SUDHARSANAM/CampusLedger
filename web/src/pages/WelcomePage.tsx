import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useSpring, useTransform } from 'framer-motion';
import {
  Package,
  Wrench,
  BarChart3,
  Archive,
  ShoppingCart,
  Monitor,
  Database,
  Shield,
} from 'lucide-react';

// ─── Floating icon config ────────────────────────────────────────────────────
const FLOAT_ICONS = [
  { Icon: Package,      label: 'Assets',      top: '14%', left: '8%',   delay: 0     },
  { Icon: Wrench,       label: 'Maintenance', top: '22%', right: '9%',  delay: 0.4   },
  { Icon: BarChart3,    label: 'Analytics',   top: '60%', left: '6%',   delay: 0.8   },
  { Icon: Archive,      label: 'Inventory',   top: '68%', right: '7%',  delay: 0.6   },
  { Icon: ShoppingCart, label: 'Procurement', top: '82%', left: '18%',  delay: 1.0   },
  { Icon: Monitor,      label: 'Monitoring',  top: '10%', right: '22%', delay: 1.2   },
  { Icon: Database,     label: 'Records',     top: '76%', right: '20%', delay: 0.2   },
  { Icon: Shield,       label: 'Blockchain',  top: '42%', left: '4%',   delay: 1.4   },
];

// ─── Gradient backgrounds for animation ─────────────────────────────────────
const BG_GRADIENTS = [
  'linear-gradient(135deg, #1a1a3e 0%, #0f2460 40%, #0d3b73 70%, #0a1628 100%)',
  'linear-gradient(135deg, #2d0a4e 0%, #1a1060 40%, #0d3b73 70%, #0a2428 100%)',
  'linear-gradient(135deg, #0a2460 0%, #1a3080 40%, #2d1060 70%, #0f1a38 100%)',
  'linear-gradient(135deg, #1a1a3e 0%, #0f2460 40%, #0d3b73 70%, #0a1628 100%)',
];

export function WelcomePage() {
  const navigate = useNavigate();

  // ── Parallax state ────────────────────────────────────────────────────────
  const rawX = useSpring(0, { stiffness: 60, damping: 20 });
  const rawY = useSpring(0, { stiffness: 60, damping: 20 });
  // Campus photo shifts up to ±18px; floating content shifts ±8px (opposite)
  const photoX  = useTransform(rawX, v => v * 18);
  const photoY  = useTransform(rawY, v => v * 18);
  const contentX = useTransform(rawX, v => v * -8);
  const contentY = useTransform(rawY, v => v * -8);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const { width, height, left, top } = e.currentTarget.getBoundingClientRect();
    rawX.set(((e.clientX - left) / width  - 0.5) * 2);   // normalised -1 → 1
    rawY.set(((e.clientY - top)  / height - 0.5) * 2);
  }, [rawX, rawY]);

  const handleMouseLeave = useCallback(() => {
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  const orbs = [
    { x: '15%', y: '20%', size: 320, color: 'rgba(99,102,241,0.18)' },
    { x: '70%', y: '60%', size: 380, color: 'rgba(16,185,129,0.12)' },
    { x: '40%', y: '80%', size: 260, color: 'rgba(168,85,247,0.14)' },
  ];

  return (
    <motion.div
      initial={{ background: BG_GRADIENTS[0] }}
      animate={{ background: BG_GRADIENTS }}
      transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontFamily: 'Inter, Segoe UI, system-ui, sans-serif' }}
    >
      {/* ── Campus photo — parallax background layer ─────────────────── */}
      <motion.img
        src="/campus_photo.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-5%',
          left: '-5%',
          width: '110%',
          height: '110%',
          objectFit: 'cover',
          opacity: 0.62,
          filter: 'brightness(0.5) saturate(0.85)',
          pointerEvents: 'none',
          zIndex: 0,
          x: photoX,
          y: photoY,
        }}
      />

      {/* Ambient orbs */}
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            left: orb.x,
            top: orb.y,
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: orb.color,
            filter: 'blur(70px)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 6 + i * 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 1.2 }}
        />
      ))}

      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
      }} />

      {/* Floating icons — subtle parallax in opposite direction */}
      <motion.div style={{ position: 'absolute', inset: 0, zIndex: 3, x: contentX, y: contentY, pointerEvents: 'none' }}>
        {FLOAT_ICONS.map(({ Icon, label, top, left, right, delay }: any) => (
        <motion.div
          key={label}
          style={{
            position: 'absolute', top, left, right,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            userSelect: 'none', pointerEvents: 'none',
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: [0, 0.6, 0.4, 0.6], y: [20, 0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay }}
        >
          <div style={{
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 14,
            padding: '10px 12px',
          }}>
            <Icon size={20} color="rgba(255,255,255,0.75)" />
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500, letterSpacing: '0.03em' }}>{label}</span>
        </motion.div>
      ))}
      </motion.div>

      {/* ── Central card ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '52px 56px 46px',
          borderRadius: 28,
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
          maxWidth: 500,
          width: '90vw',
        }}
      >
        {/* Logos */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 20 }}
        >
          <motion.div
            animate={{ boxShadow: ['0 0 0 0px rgba(99,102,241,0)', '0 0 0 14px rgba(99,102,241,0.08)', '0 0 0 0px rgba(99,102,241,0)'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ borderRadius: '50%', display: 'inline-flex' }}
          >
            <img
              src="/logo.png"
              alt="CampusLedger Logo"
              style={{
                width: 100,
                height: 100,
                objectFit: 'contain',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.95)',
                padding: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
              }}
            />
          </motion.div>

          {/* Divider between logos */}
          <div style={{ width: 1, height: 64, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

          <motion.div
            animate={{ boxShadow: ['0 0 0 0px rgba(16,185,129,0)', '0 0 0 14px rgba(16,185,129,0.07)', '0 0 0 0px rgba(16,185,129,0)'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            style={{ borderRadius: '50%', display: 'inline-flex' }}
          >
            <img
              src="/campus_logo.png"
              alt="Campus Logo"
              style={{
                width: 100,
                height: 100,
                objectFit: 'contain',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.95)',
                padding: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
              }}
            />
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.3, ease: 'easeOut' }}
          style={{
            margin: '0 0 6px',
            fontSize: 'clamp(26px, 5vw, 36px)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          CampusLedger
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.42, ease: 'easeOut' }}
          style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 500, color: 'rgba(199,208,250,0.9)', letterSpacing: '0.01em' }}
        >
          Asset &amp; Inventory Management System
        </motion.p>

        {/* Institution */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.52, ease: 'easeOut' }}
          style={{ margin: '0 0 24px', fontSize: 13, fontWeight: 400, color: 'rgba(148,163,184,0.75)' }}
        >
          Chennai Institute of Technology
        </motion.p>

        {/* Divider */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6, ease: 'easeOut' }}
          style={{
            width: '60%',
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(165,180,252,0.4), transparent)',
            marginBottom: 24,
          }}
        />

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7, ease: 'easeOut' }}
          style={{ margin: '0 0 36px', fontSize: 14, fontStyle: 'italic', color: 'rgba(148,163,184,0.8)', letterSpacing: '0.02em' }}
        >
          "Smart governance for campus infrastructure."
        </motion.p>

        {/* Login button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.85, ease: 'easeOut' }}
          whileHover={{ scale: 1.1, boxShadow: '0 16px 48px rgba(99,102,241,0.5)' }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/login')}
          style={{
            padding: '15px 64px',
            borderRadius: 50,
            border: 'none',
            cursor: 'pointer',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: '#fff',
            background: 'linear-gradient(135deg, #4f6ef7 0%, #7c3aed 100%)',
            boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
            fontFamily: 'inherit',
          }}
        >
          Login
        </motion.button>

        {/* Version badge */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          style={{ marginTop: 22, fontSize: 11, color: 'rgba(148,163,184,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          v2026 · Powered by CampusLedger
        </motion.span>
      </motion.div>
    </motion.div>
  );
}
