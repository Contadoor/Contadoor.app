# Genera assets/gestoor-aviso.mp3: el sonido de aviso de Gestoor (obra propia, sintetizado desde cero, sin muestras de terceros).
# Dos notas suaves (Mi5 → Si5) con armónicos leves y caída exponencial; ~0,7 s, volumen moderado.
# Uso: python3 assets/gestoor-aviso-generar.py /tmp/aviso.wav && ffmpeg -y -i /tmp/aviso.wav -ac 1 -b:a 64k assets/gestoor-aviso.mp3
import math, struct, wave, sys

SR = 44100
DUR = 0.75
salida = sys.argv[1] if len(sys.argv) > 1 else '/tmp/gestoor-aviso.wav'
notas = [(0.00, 659.25, 0.55), (0.13, 987.77, 0.45)]   # (inicio s, frecuencia Hz, ganancia)

muestras = []
for i in range(int(SR * DUR)):
    t = i / SR
    v = 0.0
    for ini, f, g in notas:
        dt = t - ini
        if dt < 0:
            continue
        ataque = min(1.0, dt / 0.008)                      # 8 ms de entrada, sin "clic"
        env = ataque * math.exp(-dt * 6.0)
        v += g * env * (math.sin(2 * math.pi * f * dt)
                        + 0.18 * math.sin(2 * math.pi * 2 * f * dt)
                        + 0.06 * math.sin(2 * math.pi * 3 * f * dt))
    cola = min(1.0, (DUR - t) / 0.05)                      # desvanece al final
    muestras.append(max(-1.0, min(1.0, v * 0.42 * cola)))

with wave.open(salida, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(b''.join(struct.pack('<h', int(s * 32767)) for s in muestras))
print('ok', salida)
