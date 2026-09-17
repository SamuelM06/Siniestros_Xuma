import { useState } from 'react';
import { motion } from 'motion/react';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const form = new FormData();
      form.set('username', username);
      form.set('password', password);
      const res = await fetch('/api/auth/login', { method: 'POST', body: form });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        window.location.assign('/dashboard');
        return;
      }
      setError(data.error ?? 'No se pudo iniciar sesión.');
    } catch {
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <motion.form
      onSubmit={enviar}
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="glass space-y-4 rounded-3xl p-8 w-full max-w-sm"
      aria-label="Formulario de acceso"
    >
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold text-white">Acceso restringido</h1>
        <p className="text-sm text-white/60">Portal de siniestros Xuma · 2026</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="username" className="text-sm font-semibold text-white/75">Usuario</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/35 outline-none transition-colors focus:border-xuma-verde-claro/70 focus:bg-white/10"
          placeholder="usuario"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-semibold text-white/75">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/35 outline-none transition-colors focus:border-xuma-verde-claro/70 focus:bg-white/10"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-2 text-sm text-red-200"
        >
          ⚠️ {error}
        </motion.p>
      )}

      <motion.button
        type="submit"
        disabled={cargando}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="w-full cursor-pointer rounded-xl bg-xuma-verde-claro py-3 font-bold text-[#0a1030] shadow-lg shadow-xuma-verde-claro/25 transition-colors hover:bg-xuma-verde-oscuro disabled:opacity-60"
      >
        {cargando ? 'Verificando…' : 'Ingresar 🚀'}
      </motion.button>

      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-white/40">
        🔐 Sesión cifrada · intentos limitados
      </p>
    </motion.form>
  );
}