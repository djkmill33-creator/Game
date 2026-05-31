import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const STAGE_HEIGHT = 520
const PLAYER = { y: 382, width: 52, height: 66 }
const ENTITY_START_Y = -120
const ENTITY_END_Y = STAGE_HEIGHT + 120
const BASE_OBSTACLE_SPEED = 4.8
const BASE_SPAWN_MIN = 520
const BASE_SPAWN_RANDOM = 460
const SWIPE_THRESHOLD = 42
const LANES = [
  { label: 'gauche', left: 27 },
  { label: 'centre', left: 50 },
  { label: 'droite', left: 73 },
]
const OBSTACLE_VARIANTS = [
  { width: 62, height: 74, label: 'bloc' },
  { width: 74, height: 54, label: 'barrière' },
  { width: 52, height: 92, label: 'tour' },
]
const DIFFICULTIES = {
  facile: { label: 'Facile', speed: 0.82, spawn: 1.28, score: 1 },
  moyen: { label: 'Moyen', speed: 1, spawn: 1, score: 1.2 },
  difficile: { label: 'Difficile', speed: 1.22, spawn: 0.82, score: 1.45 },
  legende: { label: 'Légende', speed: 1.48, spawn: 0.66, score: 1.8 },
}

const clampLane = (laneIndex) => Math.max(0, Math.min(LANES.length - 1, laneIndex))

function createEntity(score) {
  const laneIndex = Math.floor(Math.random() * LANES.length)
  const isBooster = Math.random() > 0.74

  if (isBooster) {
    return {
      id: crypto.randomUUID(),
      kind: 'booster',
      laneIndex,
      y: ENTITY_START_Y,
      width: 46,
      height: 46,
      value: 120,
    }
  }

  const variant = OBSTACLE_VARIANTS[Math.floor(Math.random() * OBSTACLE_VARIANTS.length)]

  return {
    id: crypto.randomUUID(),
    kind: 'obstacle',
    laneIndex,
    y: ENTITY_START_Y,
    width: variant.width,
    height: variant.height + Math.min(score / 90, 24),
    label: variant.label,
    rotation: Math.random() * 8 - 4,
  }
}

function verticalOverlap(a, b) {
  return a.y < b.y + b.height && a.y + a.height > b.y
}

function useHighScore(score, gameState) {
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem('monJeuPlusBest') || 0))

  useEffect(() => {
    if (gameState === 'over' && score > bestScore) {
      setBestScore(score)
      localStorage.setItem('monJeuPlusBest', String(score))
    }
  }, [bestScore, gameState, score])

  return bestScore
}

function App() {
  const [gameState, setGameState] = useState('ready')
  const [laneIndex, setLaneIndex] = useState(1)
  const [entities, setEntities] = useState([])
  const [score, setScore] = useState(0)
  const [boosters, setBoosters] = useState(0)
  const [speedBoost, setSpeedBoost] = useState(1)
  const [difficultyKey, setDifficultyKey] = useState('moyen')

  const lastFrameRef = useRef(0)
  const spawnTimerRef = useRef(620)
  const activePointersRef = useRef(new Map())
  const gameStateRef = useRef(gameState)
  const scoreRef = useRef(score)
  const bestScore = useHighScore(score, gameState)

  const difficulty = DIFFICULTIES[difficultyKey]
  const currentLane = LANES[laneIndex]
  const playerBox = useMemo(
    () => ({
      y: PLAYER.y + 8,
      height: PLAYER.height - 14,
      laneIndex,
    }),
    [laneIndex],
  )

  const resetGame = useCallback(() => {
    lastFrameRef.current = 0
    spawnTimerRef.current = BASE_SPAWN_MIN * difficulty.spawn
    scoreRef.current = 0
    activePointersRef.current.clear()
    setLaneIndex(1)
    setEntities([])
    setScore(0)
    setBoosters(0)
    setSpeedBoost(1)
    setGameState('playing')
  }, [difficulty.spawn])

  const changeLane = useCallback((direction) => {
    if (gameStateRef.current !== 'playing') return
    setLaneIndex((currentIndex) => clampLane(currentIndex + direction))
  }, [])

  const selectDifficulty = useCallback((nextDifficultyKey) => {
    if (gameStateRef.current === 'playing') return
    setDifficultyKey(nextDifficultyKey)
  }, [])

  const rememberPointer = useCallback((event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    activePointersRef.current.set(event.pointerId, {
      handled: false,
      startX: event.clientX,
      startY: event.clientY,
    })

    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [])

  const handlePointerMove = useCallback((event) => {
    const pointer = activePointersRef.current.get(event.pointerId)
    if (!pointer || pointer.handled) return

    const deltaX = event.clientX - pointer.startX
    const deltaY = event.clientY - pointer.startY
    const horizontalSwipe = Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.2

    if (horizontalSwipe) {
      changeLane(deltaX < 0 ? -1 : 1)
      pointer.handled = true
    }
  }, [changeLane])

  const handlePointerEnd = useCallback((event) => {
    activePointersRef.current.delete(event.pointerId)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }, [])

  const triggerTouchAction = useCallback((direction) => (event) => {
    event.preventDefault()
    event.stopPropagation()
    changeLane(direction)
  }, [changeLane])

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    scoreRef.current = score
  }, [score])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (['Enter', 'Space'].includes(event.code) && gameStateRef.current !== 'playing') {
        event.preventDefault()
        resetGame()
      }

      if (['ArrowLeft', 'KeyA'].includes(event.code)) {
        event.preventDefault()
        changeLane(-1)
      }

      if (['ArrowRight', 'KeyD'].includes(event.code)) {
        event.preventDefault()
        changeLane(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [changeLane, resetGame])

  useEffect(() => {
    let animationFrameId

    const update = (timestamp) => {
      if (!lastFrameRef.current) lastFrameRef.current = timestamp
      const delta = Math.min((timestamp - lastFrameRef.current) / 16.67, 2)
      lastFrameRef.current = timestamp

      if (gameStateRef.current === 'playing') {
        const nextScore = scoreRef.current + Math.round(delta * 2 * difficulty.score)
        const nextBoost = 1 + Math.min(nextScore / 1600, 0.9)
        const travel = BASE_OBSTACLE_SPEED * difficulty.speed * nextBoost * delta

        scoreRef.current = nextScore
        spawnTimerRef.current -= 16.67 * delta * nextBoost

        setScore(nextScore)
        setSpeedBoost(nextBoost)

        setEntities((currentEntities) => {
          let collectedBoosters = 0
          let nextEntities = currentEntities
            .map((entity) => ({ ...entity, y: entity.y + travel }))
            .filter((entity) => entity.y < ENTITY_END_Y)

          if (spawnTimerRef.current <= 0) {
            nextEntities = [...nextEntities, createEntity(nextScore)]
            spawnTimerRef.current = (BASE_SPAWN_MIN + Math.random() * BASE_SPAWN_RANDOM - Math.min(nextScore, 650) * 0.32) * difficulty.spawn
          }

          const hasCollision = nextEntities.some((entity) => {
            const sameLane = entity.laneIndex === playerBox.laneIndex
            const touchingPlayer = sameLane && verticalOverlap(playerBox, {
              y: entity.y + 5,
              height: entity.height - 10,
            })

            if (touchingPlayer && entity.kind === 'booster') {
              collectedBoosters += 1
              scoreRef.current += entity.value
              return false
            }

            return touchingPlayer && entity.kind === 'obstacle'
          })

          if (collectedBoosters) {
            setBoosters((currentBoosters) => currentBoosters + collectedBoosters)
            setScore(scoreRef.current)
            nextEntities = nextEntities.filter((entity) => {
              const sameLane = entity.laneIndex === playerBox.laneIndex
              const touchingPlayer = sameLane && verticalOverlap(playerBox, {
                y: entity.y + 5,
                height: entity.height - 10,
              })
              return !(touchingPlayer && entity.kind === 'booster')
            })
          }

          if (hasCollision) {
            setGameState('over')
          }

          return nextEntities
        })
      }

      animationFrameId = requestAnimationFrame(update)
    }

    animationFrameId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationFrameId)
  }, [difficulty.score, difficulty.spawn, difficulty.speed, playerBox])

  const distance = Math.floor(score / 10)
  return (
    <main className="shell">
      <section className="hero-panel" aria-label="Jeu d'obstacles mon jeu+">
        <div className="topbar">
          <div>
            <p className="eyebrow">Obstacle runner</p>
            <h1>mon jeu+</h1>
          </div>
          <div className="scores" aria-label="Scores">
            <span>Score <strong>{score}</strong></span>
            <span>Record <strong>{bestScore}</strong></span>
          </div>
        </div>

        <div
          className="game-stage"
          role="application"
          aria-label="Terrain de jeu. Les obstacles descendent verticalement. Swipe gauche ou droite pour changer de voie."
          onPointerCancel={handlePointerEnd}
          onPointerDown={rememberPointer}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
        >
          <div className="aurora aurora-one" />
          <div className="aurora aurora-two" />
          <div className="city city-back" />
          <div className="city city-front" />
          <div className="stars" />

          <div className="runner-track">
            {LANES.map((lane) => (
              <div className="lane-column" key={lane.label} style={{ left: `${lane.left}%` }} />
            ))}
            <div className="speed-lines" style={{ animationDuration: `${1 / speedBoost}s` }} />

            {entities.map((entity) => (
              <div
                className={`entity entity-${entity.kind}`}
                key={entity.id}
                style={{
                  height: entity.height,
                  left: `${LANES[entity.laneIndex].left}%`,
                  top: entity.y,
                  transform: `translateX(-50%) rotate(${entity.rotation || 0}deg)`,
                  width: entity.width,
                }}
                aria-label={entity.kind === 'booster' ? 'Booster bonus' : `Obstacle ${entity.label}`}
              >
                {entity.kind === 'booster' ? <span>+</span> : <span />}
              </div>
            ))}

            <div
              className="runner"
              style={{
                left: `${currentLane.left}%`,
                top: PLAYER.y,
                transform: 'translateX(-50%)',
              }}
            >
              <span className="runner-core" />
              <span className="visor" />
              <span className="jet" />
            </div>
          </div>

          {gameState !== 'playing' && (
            <div className="overlay">
              <p>{gameState === 'ready' ? 'Prêt pour la course ?' : 'Collision obstacle'}</p>
              <h2>{gameState === 'ready' ? `Choisis un niveau puis évite les obstacles rouges.` : `Score final : ${score}`}</h2>
              <button type="button" onClick={resetGame}>
                {gameState === 'ready' ? 'Démarrer' : 'Rejouer'}
              </button>
            </div>
          )}

          <div className="difficulty-picker" aria-label="Niveau de difficulté">
            {Object.entries(DIFFICULTIES).map(([key, option]) => (
              <button
                className={key === difficultyKey ? 'is-active' : ''}
                disabled={gameState === 'playing'}
                key={key}
                onClick={() => selectDifficulty(key)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="legend" aria-hidden="true">
            <span className="legend-obstacle">Obstacle</span>
            <span className="legend-booster">Booster</span>
          </div>

          <div className="touch-lane-controls" aria-label="Contrôles tactiles de voie">
            <button type="button" onPointerDown={triggerTouchAction(-1)} aria-label="Changer vers la voie de gauche">
              ←
            </button>
            <span>Gauche / Droite</span>
            <button type="button" onPointerDown={triggerTouchAction(1)} aria-label="Changer vers la voie de droite">
              →
            </button>
          </div>
        </div>

        <div className="hud">
          <article>
            <span>Distance</span>
            <strong>{distance} m</strong>
          </article>
          <article>
            <span>Boosters</span>
            <strong>{boosters}</strong>
          </article>
          <article>
            <span>Voie</span>
            <strong>{currentLane.label}</strong>
          </article>
          <article>
            <span>Niveau</span>
            <strong>{difficulty.label}</strong>
          </article>
        </div>

        <div className="controls">
          <button type="button" onClick={() => changeLane(-1)}>Gauche</button>
          <button type="button" onClick={() => changeLane(1)}>Droite</button>
          <p><kbd>←</kbd>/<kbd>→</kbd>, <kbd>A</kbd>/<kbd>D</kbd> ou swipe horizontal uniquement pour changer de voie · Niveau : {difficulty.label}.</p>
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
