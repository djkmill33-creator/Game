import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const LANES = [17, 50, 83];
const TICK_RATE = 1000 / 60;
const TRACK_BOTTOM = 91;
const PLAYER_Y = 80;
const COLLISION_Y = 7.5;
const SPAWN_Y = -16;
const BOOST_DURATION = 210;
const SHIELD_DURATION = 260;
const INITIAL_STATE = {
  running: false,
  finished: false,
  lane: 1,
  score: 0,
  best: 0,
  speed: 0.72,
  combo: 1,
  shield: 0,
  boost: 0,
  obstacles: [],
  orbs: [],
  nextObstacleIn: 38,
  nextOrbIn: 86,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomLane(exceptLane = -1) {
  const options = [0, 1, 2].filter((lane) => lane !== exceptLane);
  return options[Math.floor(Math.random() * options.length)];
}

function makeObstacle(lastLane) {
  const variants = ['barrier', 'drone', 'gate'];
  return {
    id: crypto.randomUUID(),
    lane: randomLane(lastLane),
    y: SPAWN_Y,
    variant: variants[Math.floor(Math.random() * variants.length)],
  };
}

function makeOrb(lastLane) {
  return {
    id: crypto.randomUUID(),
    lane: randomLane(lastLane),
    y: SPAWN_Y - 8,
    type: Math.random() > 0.68 ? 'shield' : 'boost',
  };
}

function useAnimationFrame(callback, isActive) {
  const requestRef = useRef();
  const lastRef = useRef();

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const animate = (time) => {
      if (lastRef.current === undefined) {
        lastRef.current = time;
      }

      const delta = time - lastRef.current;
      lastRef.current = time;
      callback(delta / TICK_RATE);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(requestRef.current);
      lastRef.current = undefined;
    };
  }, [callback, isActive]);
}

function App() {
  const [game, setGame] = useState(() => ({
    ...INITIAL_STATE,
    best: Number(localStorage.getItem('nebula-dash-best') || 0),
  }));
  const lastLaneRef = useRef(1);

  const startGame = useCallback(() => {
    setGame((current) => ({
      ...INITIAL_STATE,
      running: true,
      best: current.best,
      obstacles: [makeObstacle(1)],
    }));
    lastLaneRef.current = 1;
  }, []);

  const move = useCallback((direction) => {
    setGame((current) => {
      if (!current.running) {
        return current;
      }
      return { ...current, lane: clamp(current.lane + direction, 0, 2) };
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        move(-1);
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        move(1);
      }
      if (event.key === ' ' || event.key === 'Enter') {
        startGame();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [move, startGame]);

  const updateGame = useCallback((delta) => {
    setGame((current) => {
      if (!current.running) {
        return current;
      }

      let score = current.score + current.speed * delta * current.combo;
      let speed = Math.min(2.25, current.speed + 0.0009 * delta);
      let combo = Math.max(1, current.combo - 0.0017 * delta);
      let shield = Math.max(0, current.shield - delta);
      let boost = Math.max(0, current.boost - delta);
      let nextObstacleIn = current.nextObstacleIn - delta * (boost > 0 ? 1.35 : 1);
      let nextOrbIn = current.nextOrbIn - delta;
      let obstacles = current.obstacles.map((obstacle) => ({
        ...obstacle,
        y: obstacle.y + speed * delta * (boost > 0 ? 1.22 : 1),
      }));
      let orbs = current.orbs.map((orb) => ({
        ...orb,
        y: orb.y + speed * delta * 1.05,
      }));

      if (nextObstacleIn <= 0) {
        const obstacle = makeObstacle(lastLaneRef.current);
        lastLaneRef.current = obstacle.lane;
        obstacles = [...obstacles, obstacle];
        nextObstacleIn = Math.max(22, 52 - speed * 9 + Math.random() * 28);
      }

      if (nextOrbIn <= 0) {
        const orb = makeOrb(lastLaneRef.current);
        orbs = [...orbs, orb];
        nextOrbIn = 118 + Math.random() * 92;
      }

      const hitObstacle = obstacles.find(
        (obstacle) => obstacle.lane === current.lane && Math.abs(obstacle.y - PLAYER_Y) < COLLISION_Y,
      );
      const collectedOrb = orbs.find(
        (orb) => orb.lane === current.lane && Math.abs(orb.y - PLAYER_Y) < COLLISION_Y,
      );

      if (collectedOrb) {
        score += collectedOrb.type === 'boost' ? 140 : 90;
        combo = Math.min(4, combo + 0.55);
        boost = collectedOrb.type === 'boost' ? BOOST_DURATION : boost;
        shield = collectedOrb.type === 'shield' ? SHIELD_DURATION : shield;
        orbs = orbs.filter((orb) => orb.id !== collectedOrb.id);
      }

      if (hitObstacle) {
        if (shield > 0) {
          score += 55;
          combo = Math.min(4, combo + 0.25);
          shield = 0;
          obstacles = obstacles.filter((obstacle) => obstacle.id !== hitObstacle.id);
        } else {
          const finalScore = Math.round(score);
          const best = Math.max(current.best, finalScore);
          localStorage.setItem('nebula-dash-best', String(best));
          return {
            ...current,
            running: false,
            finished: true,
            score: finalScore,
            best,
            shield,
            boost,
            obstacles,
            orbs,
          };
        }
      }

      obstacles = obstacles.filter((obstacle) => obstacle.y < TRACK_BOTTOM + 12);
      orbs = orbs.filter((orb) => orb.y < TRACK_BOTTOM + 10);

      return {
        ...current,
        score,
        best: Math.max(current.best, Math.round(score)),
        speed,
        combo,
        shield,
        boost,
        obstacles,
        orbs,
        nextObstacleIn,
        nextOrbIn,
      };
    });
  }, []);

  useAnimationFrame(updateGame, game.running);

  const statusText = useMemo(() => {
    if (game.running) {
      return game.boost > 0 ? 'Hyper vitesse' : game.shield > 0 ? 'Bouclier actif' : 'En course';
    }
    return game.finished ? 'Collision détectée' : 'Prêt au départ';
  }, [game.boost, game.finished, game.running, game.shield]);

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Runner arcade futuriste</p>
          <h1>Nebula Dash</h1>
          <p className="intro">
            Change de voie, évite les drones et attrape les modules d'énergie pour prolonger ton combo.
          </p>
        </div>
        <div className="score-card" aria-label="Score actuel">
          <span>Score</span>
          <strong>{Math.round(game.score).toLocaleString('fr-FR')}</strong>
        </div>
      </section>

      <section className="game-layout">
        <aside className="hud-panel">
          <Stat label="Record" value={game.best.toLocaleString('fr-FR')} />
          <Stat label="Vitesse" value={`${game.speed.toFixed(2)}x`} />
          <Stat label="Combo" value={`${game.combo.toFixed(1)}x`} />
          <div className="status-pill">{statusText}</div>
          <button className="primary-action" type="button" onClick={startGame}>
            {game.running ? 'Recommencer' : game.finished ? 'Relancer' : 'Démarrer'}
          </button>
          <div className="controls">
            <p>Contrôles</p>
            <span>← / A</span>
            <span>→ / D</span>
            <span>Espace pour lancer</span>
          </div>
        </aside>

        <div className="track-card" aria-label="Piste de jeu Nebula Dash">
          <div className="track-glow" />
          <div className="track">
            {LANES.map((lane, index) => (
              <div className="lane-line" style={{ left: `${lane}%` }} key={lane} aria-hidden="true">
                <span>{index + 1}</span>
              </div>
            ))}

            <div className={`runner ${game.shield > 0 ? 'is-shielded' : ''}`} style={{ left: `${LANES[game.lane]}%` }}>
              <div className="runner-core" />
            </div>

            {game.obstacles.map((obstacle) => (
              <div
                className={`obstacle obstacle-${obstacle.variant}`}
                style={{ left: `${LANES[obstacle.lane]}%`, top: `${obstacle.y}%` }}
                key={obstacle.id}
              >
                <span />
              </div>
            ))}

            {game.orbs.map((orb) => (
              <div className={`orb orb-${orb.type}`} style={{ left: `${LANES[orb.lane]}%`, top: `${orb.y}%` }} key={orb.id}>
                {orb.type === 'shield' ? '◇' : '✦'}
              </div>
            ))}

            {!game.running && (
              <div className="overlay-card">
                <p>{game.finished ? 'Fin de course' : 'Mission Nebula'}</p>
                <h2>{game.finished ? `${Math.round(game.score).toLocaleString('fr-FR')} pts` : 'Évite les obstacles'}</h2>
                <button type="button" onClick={startGame}>
                  {game.finished ? 'Retenter' : 'Jouer maintenant'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
