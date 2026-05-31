import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const GAME_WIDTH = 960
const GROUND_Y = 415
const PLAYER = { x: 120, width: 48, height: 62 }
const GRAVITY = 0.86
const JUMP_FORCE = -16.8
const SLIDE_DURATION = 620
const OBSTACLE_SPEED = 6.1
const SPAWN_MIN = 760
const SPAWN_RANDOM = 720
const SWIPE_THRESHOLD = 46
const TAP_THRESHOLD = 14
const TAP_DURATION = 260
const LANES = [
  { label: 'gauche', offset: -54, scale: 0.92 },
  { label: 'centre', offset: 0, scale: 1 },
  { label: 'droite', offset: 54, scale: 1.08 },
]
const COLORS = ['#00e5ff', '#9b5cff', '#ff4ecd', '#7cff6b', '#ffd166']

const randomBetween = (min, max) => min + Math.random() * (max - min)
const clampLane = (laneIndex) => Math.max(0, Math.min(LANES.length - 1, laneIndex))

function createObstacle(score) {
  const flying = Math.random() > 0.72 && score > 120
  const width = randomBetween(34, 70)
  const height = flying ? randomBetween(34, 56) : randomBetween(54, 118)
  const laneIndex = Math.floor(Math.random() * LANES.length)
  const laneGround = GROUND_Y + LANES[laneIndex].offset

  return {
    id: crypto.randomUUID(),
    x: GAME_WIDTH + 60,
    y: flying ? laneGround - randomBetween(150, 205) : laneGround - height,
    width,
    height,
    laneIndex,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    type: flying ? 'drone' : 'block',
    rotation: randomBetween(-6, 6),
  }
}

function rectanglesOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

function useHighScore(score, gameState) {
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem('neonDashBest') || 0))

  useEffect(() => {
    if (gameState === 'over' && score > bestScore) {
      setBestScore(score)
      localStorage.setItem('neonDashBest', String(score))
    }
  }, [bestScore, gameState, score])

  return bestScore
}

function App() {
  const [gameState, setGameState] = useState('ready')
  const [playerY, setPlayerY] = useState(GROUND_Y - PLAYER.height)
  const [laneIndex, setLaneIndex] = useState(1)
  const [isSliding, setIsSliding] = useState(false)
  const [obstacles, setObstacles] = useState([])
  const [score, setScore] = useState(0)
  const [speedBoost, setSpeedBoost] = useState(1)

  const velocityRef = useRef(0)
  const lastFrameRef = useRef(0)
  const spawnTimerRef = useRef(950)
  const slideTimerRef = useRef(null)
  const activePointersRef = useRef(new Map())
  const gameStateRef = useRef(gameState)
  const scoreRef = useRef(score)
  const bestScore = useHighScore(score, gameState)

  const currentLane = LANES[laneIndex]
  const playerHeight = isSliding ? 34 : PLAYER.height
  const playerTop = (isSliding ? GROUND_Y - 34 : playerY) + currentLane.offset
  const playerScale = currentLane.scale
  const isGrounded = playerY >= GROUND_Y - PLAYER.height - 1

  const playerBox = useMemo(
    () => ({
      x: PLAYER.x + 7,
      y: playerTop + 6,
      width: (PLAYER.width - 12) * playerScale,
      height: (playerHeight - 9) * playerScale,
      laneIndex,
    }),
    [laneIndex, playerHeight, playerScale, playerTop],
  )

  const resetGame = useCallback(() => {
    velocityRef.current = 0
    lastFrameRef.current = 0
    spawnTimerRef.current = 950
    scoreRef.current = 0
    activePointersRef.current.clear()
    setPlayerY(GROUND_Y - PLAYER.height)
    setLaneIndex(1)
    setIsSliding(false)
    setObstacles([])
    setScore(0)
    setSpeedBoost(1)
    setGameState('playing')
  }, [])

  const changeLane = useCallback((direction) => {
    if (gameStateRef.current !== 'playing') return
    setLaneIndex((currentIndex) => clampLane(currentIndex + direction))
  }, [])

  const jump = useCallback(() => {
    if (gameStateRef.current === 'ready' || gameStateRef.current === 'over') {
      resetGame()
      return
    }

    if (gameStateRef.current === 'playing' && isGrounded && !isSliding) {
      velocityRef.current = JUMP_FORCE
    }
  }, [isGrounded, isSliding, resetGame])

  const slide = useCallback(() => {
    if (gameStateRef.current !== 'playing' || !isGrounded) return
    setIsSliding(true)
    window.clearTimeout(slideTimerRef.current)
    slideTimerRef.current = window.setTimeout(() => setIsSliding(false), SLIDE_DURATION)
  }, [isGrounded])

  const rememberPointer = useCallback((event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    activePointersRef.current.set(event.pointerId, {
      handled: false,
      startTime: performance.now(),
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
    const horizontalSwipe = Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.15
    const verticalSwipe = Math.abs(deltaY) > SWIPE_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX) * 1.15

    if (horizontalSwipe) {
      changeLane(deltaX < 0 ? -1 : 1)
      pointer.handled = true
      return
    }

    if (verticalSwipe) {
      if (deltaY < 0) jump()
      if (deltaY > 0) slide()
      pointer.handled = true
    }
  }, [changeLane, jump, slide])

  const handlePointerEnd = useCallback((event) => {
    const pointer = activePointersRef.current.get(event.pointerId)
    if (!pointer) return

    const deltaX = event.clientX - pointer.startX
    const deltaY = event.clientY - pointer.startY
    const elapsed = performance.now() - pointer.startTime
    const isTap = Math.hypot(deltaX, deltaY) < TAP_THRESHOLD && elapsed < TAP_DURATION

    if (!pointer.handled && isTap) {
      jump()
    }

    activePointersRef.current.delete(event.pointerId)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }, [jump])

  const triggerTouchAction = useCallback((action) => (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (action === 'left') changeLane(-1)
    if (action === 'right') changeLane(1)
    if (action === 'jump') jump()
    if (action === 'slide') slide()
  }, [changeLane, jump, slide])

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    scoreRef.current = score
  }, [score])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
        event.preventDefault()
        jump()
      }

      if (['ArrowDown', 'KeyS'].includes(event.code)) {
        event.preventDefault()
        slide()
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
  }, [changeLane, jump, slide])

  useEffect(() => () => window.clearTimeout(slideTimerRef.current), [])

  useEffect(() => {
    let animationFrameId

    const update = (timestamp) => {
      if (!lastFrameRef.current) lastFrameRef.current = timestamp
      const delta = Math.min((timestamp - lastFrameRef.current) / 16.67, 2)
      lastFrameRef.current = timestamp

      if (gameStateRef.current === 'playing') {
        const nextScore = scoreRef.current + Math.round(delta * 2)
        const nextBoost = 1 + Math.min(nextScore / 1400, 0.95)
        const travel = OBSTACLE_SPEED * nextBoost * delta

        scoreRef.current = nextScore
        spawnTimerRef.current -= 16.67 * delta * nextBoost

        setScore(nextScore)
        setSpeedBoost(nextBoost)

        setPlayerY((currentY) => {
          const nextVelocity = velocityRef.current + GRAVITY * delta
          const nextY = Math.min(currentY + nextVelocity * delta, GROUND_Y - PLAYER.height)
          velocityRef.current = nextY >= GROUND_Y - PLAYER.height ? 0 : nextVelocity
          return nextY
        })

        setObstacles((currentObstacles) => {
          let nextObstacles = currentObstacles
            .map((obstacle) => ({ ...obstacle, x: obstacle.x - travel }))
            .filter((obstacle) => obstacle.x + obstacle.width > -30)

          if (spawnTimerRef.current <= 0) {
            nextObstacles = [...nextObstacles, createObstacle(nextScore)]
            spawnTimerRef.current = SPAWN_MIN + Math.random() * SPAWN_RANDOM - Math.min(nextScore, 700) * 0.42
          }

          const hasCollision = nextObstacles.some((obstacle) =>
            obstacle.laneIndex === playerBox.laneIndex &&
            rectanglesOverlap(playerBox, {
              x: obstacle.x + 6,
              y: obstacle.y + 5,
              width: (obstacle.width - 12) * LANES[obstacle.laneIndex].scale,
              height: (obstacle.height - 10) * LANES[obstacle.laneIndex].scale,
            }),
          )

          if (hasCollision) {
            setGameState('over')
          }

          return nextObstacles
        })
      }

      animationFrameId = requestAnimationFrame(update)
    }

    animationFrameId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationFrameId)
  }, [playerBox])

  const distance = Math.floor(score / 10)
  const difficulty = Math.min(100, Math.round((speedBoost - 1) * 105))

  return (
    <main className="shell">
      <section className="hero-panel" aria-label="Jeu d'obstacles Neon Dash">
        <div className="topbar">
          <div>
            <p className="eyebrow">Obstacle runner</p>
            <h1>Neon Dash</h1>
          </div>
          <div className="scores" aria-label="Scores">
            <span>Score <strong>{score}</strong></span>
            <span>Record <strong>{bestScore}</strong></span>
          </div>
        </div>

        <div
          className="game-stage"
          role="application"
          aria-label="Terrain de jeu. Swipe gauche ou droite pour changer de voie, swipe haut pour sauter, swipe bas pour glisser."
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
            <div className="lane-guide lane-guide-left" />
            <div className="lane-guide lane-guide-center" />
            <div className="lane-guide lane-guide-right" />
            <div className="track-glow" />
            <div className="speed-lines" style={{ animationDuration: `${1.1 / speedBoost}s` }} />
            <div
              className={`runner lane-${currentLane.label} ${isSliding ? 'is-sliding' : ''} ${!isGrounded ? 'is-jumping' : ''}`}
              style={{
                transform: `translate3d(${PLAYER.x}px, ${playerTop}px, 0) scale(${playerScale})`,
                zIndex: 5 + laneIndex,
              }}
            >
              <span className="runner-core" />
              <span className="visor" />
              <span className="jet" />
            </div>

            {obstacles.map((obstacle) => (
              <div
                className={`obstacle obstacle-${obstacle.type}`}
                key={obstacle.id}
                style={{
                  '--accent': obstacle.color,
                  height: obstacle.height,
                  left: obstacle.x,
                  top: obstacle.y,
                  transform: `rotate(${obstacle.rotation}deg) scale(${LANES[obstacle.laneIndex].scale})`,
                  width: obstacle.width,
                  zIndex: 4 + obstacle.laneIndex,
                }}
              >
                <span />
              </div>
            ))}
          </div>

          {gameState !== 'playing' && (
            <div className="overlay">
              <p>{gameState === 'ready' ? 'Prêt pour la course ?' : 'Collision détectée'}</p>
              <h2>{gameState === 'ready' ? 'Saute, glisse, change de voie.' : `Score final : ${score}`}</h2>
              <button type="button" onClick={resetGame}>
                {gameState === 'ready' ? 'Démarrer' : 'Rejouer'}
              </button>
            </div>
          )}

          <div className="touch-lane-controls" aria-label="Contrôles tactiles de voie">
            <button type="button" onPointerDown={triggerTouchAction('left')} aria-label="Changer vers la voie de gauche">
              ←
            </button>
            <span>Voie {laneIndex + 1}/3</span>
            <button type="button" onPointerDown={triggerTouchAction('right')} aria-label="Changer vers la voie de droite">
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
            <span>Vitesse</span>
            <strong>x{speedBoost.toFixed(2)}</strong>
          </article>
          <article>
            <span>Voie</span>
            <strong>{currentLane.label}</strong>
          </article>
          <article>
            <span>Difficulté</span>
            <strong>{difficulty}%</strong>
          </article>
        </div>

        <div className="controls">
          <button type="button" onClick={jump}>Sauter</button>
          <button type="button" onClick={slide}>Glisser</button>
          <button type="button" onClick={() => changeLane(-1)}>Gauche</button>
          <button type="button" onClick={() => changeLane(1)}>Droite</button>
          <p><kbd>←</kbd>/<kbd>→</kbd> ou swipe horizontal pour changer de voie · <kbd>Espace</kbd>/<kbd>↑</kbd> pour sauter · <kbd>↓</kbd> pour glisser</p>
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
