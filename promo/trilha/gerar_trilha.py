"""Trilha original do vídeo promocional do Locarion (30 s, 120 BPM).

Tudo é sintetizado aqui (nenhuma amostra externa), então a música pode ser
usada livremente. Os acentos caem nas trocas de cena da timeline do vídeo:
6.0 s, 12.3 s, 18.35 s, 24.4 s e o logo em 27.3 s.

Uso: python3 gerar_trilha.py saida.wav
"""
import sys
import numpy as np
from scipy.signal import lfilter, butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
DUR = 30.0
N = int(SR * DUR)
BPM = 120
BEAT = 60 / BPM          # 0,5 s
BAR = 4 * BEAT           # 2 s
rng = np.random.default_rng(7)

HITS = [6.0, 12.3, 18.35, 24.4]   # trocas de cena
LOGO = 27.3

def t_axis(n):
    return np.arange(n) / SR

def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain

def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)

def env_ad(n, a, d):
    t = t_axis(n)
    e = np.minimum(t / max(a, 1e-4), 1.0) * np.exp(-np.maximum(t - a, 0) / d)
    return e

def saw(f, n, detune=0.0):
    t = t_axis(n)
    ph = (f * (1 + detune)) * t
    return 2 * (ph - np.floor(ph + 0.5))

def lowpass(x, fc, order=2):
    sos = butter(order, min(fc, SR * 0.45), btype="low", fs=SR, output="sos")
    return sosfilt(sos, x)

def highpass(x, fc, order=2):
    sos = butter(order, fc, btype="high", fs=SR, output="sos")
    return sosfilt(sos, x)

def bandpass(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return sosfilt(sos, x)

# ---------------- harmonia: vi - IV - I - V em Dó (Am F C G) ----------------
PROG = [
    (57, [57, 60, 64, 69]),   # Am
    (53, [53, 57, 60, 65]),   # F
    (48, [55, 60, 64, 67]),   # C
    (55, [55, 59, 62, 67]),   # G
]

def chord_at(t):
    return PROG[int(t // BAR) % 4]

# ---------------- instrumentos ----------------
def kick():
    n = int(0.45 * SR); t = t_axis(n)
    f = 45 + 95 * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.22)
    click = highpass(rng.standard_normal(n), 2000) * np.exp(-t / 0.004) * 0.25
    return np.tanh(1.6 * (body + click))

def clap():
    n = int(0.3 * SR); t = t_axis(n)
    noise = bandpass(rng.standard_normal(n), 900, 5000)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        e += (t >= off) * np.exp(-np.maximum(t - off, 0) / (0.012 if k < 2 else 0.11))
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.3
    return (noise * e + tone) * 0.7

def hat(open_=False):
    n = int((0.25 if open_ else 0.08) * SR); t = t_axis(n)
    x = highpass(rng.standard_normal(n), 7000, 4)
    return x * np.exp(-t / (0.09 if open_ else 0.022)) * 0.35

def pluck(f, n):
    t = t_axis(n)
    x = 0.6 * np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * saw(f, n)
    return lowpass(x * env_ad(n, 0.003, 0.16), 5200)

def bass_note(f, n):
    x = 0.7 * saw(f, n) + 0.5 * np.sin(2 * np.pi * f * t_axis(n))
    x = lowpass(x, 520)
    return x * env_ad(n, 0.004, 0.18)

def pad(notes, n):
    x = np.zeros(n)
    for m in notes:
        f = midi(m)
        for d in (-0.006, 0.0, 0.007):
            x += saw(f, n, d)
    x = lowpass(x / (len(notes) * 3), 1800)
    e = np.minimum(t_axis(n) / 0.35, 1.0)
    e *= np.minimum((n - np.arange(n)) / (0.25 * SR), 1.0)
    return x * e

def riser(length):
    n = int(length * SR); t = t_axis(n)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    seg = 1024
    for s in range(0, n, seg):
        p = s / n
        fc = 400 + 9000 * p ** 2
        out[s:s + seg] = bandpass(x[s:s + seg + 0], fc * 0.6, min(fc * 1.4, 20000))[: len(out[s:s + seg])]
    sweep = np.sin(2 * np.pi * np.cumsum(200 + 900 * (t / length) ** 2) / SR) * 0.15
    return (out * 0.5 + sweep) * (t / length) ** 2

def impact(long=1.6):
    n = int(long * SR); t = t_axis(n)
    f = 30 + 70 * np.exp(-t / 0.12)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (long * 0.35))
    crash = highpass(rng.standard_normal(n), 3000) * np.exp(-t / (long * 0.3)) * 0.35
    return np.tanh(1.3 * boom) + crash

def reverse_swell(length=0.9):
    n = int(length * SR); t = t_axis(n)
    x = highpass(rng.standard_normal(n), 2500) * (t / length) ** 3 * 0.5
    return x

# ---------------- arranjo ----------------
drums = np.zeros(N); bass = np.zeros(N); pads = np.zeros(N)
plucks = np.zeros(N); fx = np.zeros(N)

K, C, H, HO = kick(), clap(), hat(), hat(True)
beats = int(DUR / BEAT)
for b in range(beats):
    t = b * BEAT
    if t < 2.0 or (24.4 <= t < LOGO) or t >= LOGO:
        continue                     # intro, respiro antes do logo e final
    lvl = 0.75 if t < 6 else 1.0
    place(drums, K, t, 0.95 * lvl)
    if b % 2 == 1 and t >= 6:
        place(drums, C, t, 0.55)
    place(drums, H, t + BEAT / 2, 0.6 * lvl)
    if t >= 12.3 and b % 4 == 3:
        place(drums, HO, t + BEAT / 2, 0.5)
    if t >= 18.35:
        place(drums, H, t + BEAT / 4, 0.25)
        place(drums, H, t + 3 * BEAT / 4, 0.25)

# baixo em colcheias, a partir de 2 s
for k in range(int(DUR / (BEAT / 2))):
    t = k * BEAT / 2
    if t < 2.0 or t >= LOGO - 0.1:
        continue
    root, _ = chord_at(t)
    f = midi(root - 24 if root > 50 else root - 12)
    oct_ = 2 if (k % 4 == 3 and t >= 12) else 1
    place(bass, bass_note(f * oct_, int(0.24 * SR)), t, 0.45)

# pad em cada compasso (o tempo todo, mais baixo no começo)
for bar in range(int(DUR / BAR) + 1):
    t = bar * BAR
    _, notes = chord_at(t)
    place(pads, pad(notes, int(BAR * SR) + int(0.2 * SR)), t, 0.6 if t < 2 else 0.22)

# arpejo em semicolcheias a partir de 6 s, com padrão que sobe
ARP = [0, 1, 2, 3, 2, 1, 3, 2]
for k in range(int(DUR / (BEAT / 4))):
    t = k * BEAT / 4
    if t < 6.0 or t >= LOGO:
        continue
    _, notes = chord_at(t)
    m = notes[ARP[k % 8] % len(notes)] + 12
    if t >= 18.35 and k % 8 in (3, 6):
        m += 12
    place(plucks, pluck(midi(m), int(0.3 * SR)), t, 0.22)

# efeitos de transição
place(fx, riser(1.9), 6.0 - 1.9, 0.5)
for h in HITS:
    place(fx, reverse_swell(0.8), h - 0.8, 0.6)
    place(fx, impact(1.6), h, 0.75)
place(fx, riser(2.8), LOGO - 2.8, 0.65)
place(fx, impact(2.6), LOGO, 1.0)

# acorde final sustentado (logo) com fade até o fim
n_end = N - int(LOGO * SR)
final = pad([45, 57, 60, 64, 69, 76], n_end) * np.exp(-t_axis(n_end) / 1.6)
place(pads, final, LOGO, 0.6)
place(bass, lowpass(np.sin(2 * np.pi * midi(33) * t_axis(n_end)), 200) * np.exp(-t_axis(n_end) / 1.2), LOGO, 0.5)
# brilho do logo: notas altas
for i, m in enumerate([76, 81, 84, 88]):
    place(plucks, pluck(midi(m), int(0.8 * SR)), LOGO + 0.12 * i, 0.22)

# ---------------- mix ----------------
# sidechain: pad, baixo e arpejo "respiram" com o bumbo
duck = np.ones(N)
for b in range(beats):
    t = b * BEAT
    if t < 2.0 or t >= 24.4:
        continue
    i = int(t * SR); n = int(0.28 * SR)
    curve = 1 - 0.55 * np.exp(-t_axis(n) / 0.08)
    duck[i:i + n] = np.minimum(duck[i:i + n], curve[: len(duck[i:i + n])])

music = drums + (bass + pads * 0.9 + plucks) * duck

def reverb(x, secs=1.8, wet=0.18):
    n = int(secs * SR)
    ir = rng.standard_normal(n) * np.exp(-t_axis(n) / (secs / 5))
    ir = lowpass(ir, 6000); ir /= np.sqrt(np.sum(ir ** 2))
    return x + wet * fftconvolve(x, ir)[: len(x)]

def stereo_delay(x, d=BEAT * 0.75, fb=0.35, mix=0.25):
    l = x.copy(); r = x.copy()
    k = int(d * SR)
    echo = np.zeros_like(x); src = x.copy()
    for rep in range(1, 5):
        sh = np.zeros_like(x); sh[k * rep:] = src[: -k * rep] * (fb ** rep)
        echo += sh
    l += echo * mix; r += np.roll(echo, int(0.012 * SR)) * mix
    return l, r

pl_l, pl_r = stereo_delay(plucks * duck)
mono = drums + bass * duck
pad_s = pads * 0.9 * duck
L = mono + pad_s * 1.0 + pl_l + fx * 0.9
R = mono + np.roll(pad_s, int(0.008 * SR)) + pl_r + fx * 0.9
L = reverb(L); R = reverb(R)
# sem DC e sem subgrave inaudível (limpa o grave em caixinhas de celular)
L = highpass(L, 30, 4); R = highpass(R, 30, 4)

# fade in curto, fade out final
fade = np.ones(N)
fi = int(0.4 * SR); fade[:fi] = np.linspace(0, 1, fi)
fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
L *= fade; R *= fade

st = np.stack([L, R], axis=1)
st = np.tanh(st / np.max(np.abs(st)) * 1.4) / np.tanh(1.4)
st *= 10 ** (-1.0 / 20)
wavfile.write(sys.argv[1] if len(sys.argv) > 1 else "trilha.wav", SR, (st * 32767).astype(np.int16))
print("ok", st.shape)
