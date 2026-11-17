"use client"

import { useState, useEffect, useTransition, useRef, type FormEvent, type SyntheticEvent } from "react"
import { createClient } from "@/app/lib/client"
import { 
  getSynapseItems, 
  createSynapseItem, 
  getSuggestedChunks,
  updateUserProfileLevel
} from "@/app/actions/synapse-actions"

// Taxonomía de Contextos Comunicativos MCER para la Sala Spiking
const MCER_CONTEXTS: Record<string, { label: string; icon: string }[]> = {
  A1: [
    { label: "Contexto personal y familiar: Presentarse y hablar de origen/edad", icon: "👤" },
    { label: "Contexto público inmediato: Pedir un café o comprar en el supermercado", icon: "☕" },
    { label: "Contexto escolar/rutinario: Seguir instrucciones directas en el aula", icon: "🏫" },
  ],
  A2: [
    { label: "Contexto cotidiano: Intercambiar sobre familia, empleo y rutinas", icon: "🏠" },
    { label: "Contexto de supervivencia turística: Pedir comida o direcciones en viajes", icon: "✈️" },
    { label: "Contexto laboral elemental: Tareas simples y cortesía con compañeros", icon: "💼" },
  ],
  B1: [
    { label: "Contexto de viaje autónomo: Resolver emergencias o quejas hoteleras", icon: "🧳" },
    { label: "Contexto de ocio y opinión: Explicar planes, deseos y opiniones de temas de interés", icon: "🗣️" },
    { label: "Contexto laboral general: Redactar o exponer asuntos cotidianos del trabajo", icon: "📧" },
  ],
  B2: [
    { label: "Contexto técnico y profesional: Debatir dentro de mi campo de especialización", icon: "📊" },
    { label: "Contexto social fluido: Interactuar con fluidez y naturalidad sin tensión", icon: "💬" },
    { label: "Contexto argumentativo: Defender un punto de vista y sopesar pros/contras", icon: "⚖️" },
  ],
  C1: [
    { label: "Contexto institucional exigente: Negociaciones y reuniones de alto nivel", icon: "🏛️" },
    { label: "Contexto de análisis implícito: Comprender y responder a ironías o dobles sentidos", icon: "🧩" },
    { label: "Contexto académico avanzado: Argumentar temas complejos con alta cohesión", icon: "🎓" },
  ],
  C2: [
    { label: "Contexto de máxima exigencia formal: Debates sociopolíticos o conferencias", icon: "🎙️" },
    { label: "Contexto literario y cultural: Interpretar matices profundos, giros y regionalismos", icon: "📚" },
    { label: "Contexto de negociación e intermediación: Sortear dificultades lingüísticas al instante", icon: "🌐" },
  ],
}

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

type SynapseItem = {
  id: string
  source_text: string
  target_text: string
  category?: string | null
  created_at?: string | null
}

type SuggestedChunk = Record<string, unknown>
type AudioPlaybackProgress = { lastTime: number; playedSeconds: number; duration: number }

const getChunkField = (item: SuggestedChunk, keys: string[]) => {
  for (const key of keys) {
    const value = item[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

const getChunkSource = (item: SuggestedChunk) =>
  getChunkField(item, ["source_text", "english_text", "english", "phrase", "chunk", "text"])

const getChunkTarget = (item: SuggestedChunk) =>
  getChunkField(item, ["target_text", "spanish_text", "spanish", "translation", "meaning"])

export default function Home() {
  const [supabase] = useState(() => createClient())
  const [isPending, startTransition] = useTransition()
  const [authStatus, setAuthStatus] = useState<"loading" | "signed-out" | "signed-in">("loading")
  const [userId, setUserId] = useState<string | null>(null)
  const authUserIdRef = useRef<string | null>(null)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginMessage, setLoginMessage] = useState("")
  const [loginError, setLoginError] = useState("")
  const [isLoginPending, setIsLoginPending] = useState(false)
  const [actionError, setActionError] = useState("")

  // Estados de datos
  const [synapses, setSynapses] = useState<SynapseItem[]>([])
  const [suggestedChunks, setSuggestedChunks] = useState<SuggestedChunk[]>([])
  const [sourceText, setSourceText] = useState("")
  const [targetText, setTargetText] = useState("")
  
  // Estado para colapsar/desplegar la lista de registros dentro de Synapsing

  // Desplegables de instructivos operativos en cada sala
  const [isSynapsingGuideOpen, setIsSynapsingGuideOpen] = useState(false)

  // Nivel activo para el Selector Táctico (A1 a C2)
  const [userLevel, setUserLevel] = useState("B1")

  // Estado de Onboarding (0 = cerrado, 1 = MI COMPROMISO inicial, 2 = Manual Operativo y Científico)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const admissionDialogRef = useRef<HTMLDivElement>(null)
  const navigationDialogRef = useRef<HTMLDivElement>(null)

  // Estado de expansión científica por cada sala dentro del Manual
  const [expandedOnboardingCard, setExpandedOnboardingCard] = useState<string | null>(null)

  // Estado del Reporte de Cierre de Sesión
  const [isClosureReportOpen, setIsClosureReportOpen] = useState(false)
  const closureReportDialogRef = useRef<HTMLDivElement>(null)

  // ESTADO DE LAS 4 SALAS DE ENTRENAMIENTO (MODALES)
  const [isSynapsingOpen, setIsSynapsingOpen] = useState(false)
  const synapsingDialogRef = useRef<HTMLDivElement>(null)
  
  // Modal Shadowing
  const [isShadowingOpen, setIsShadowingOpen] = useState(false)
  const shadowingDialogRef = useRef<HTMLDivElement>(null)
  const [selectedItemForPracticeId, setSelectedItemForPracticeId] = useState<string | null>(null)
  const [practicedItemsCount, setPracticedItemsCount] = useState(0)
  const [practicedIds, setPracticedIds] = useState<string[]>([])
  const [recordingItemId, setRecordingItemId] = useState<string | null>(null)
  const [shadowingAudioReviewed, setShadowingAudioReviewed] = useState(false)
  const [shadowingError, setShadowingError] = useState("")
  const shadowingPlaybackRef = useRef<AudioPlaybackProgress>({ lastTime: 0, playedSeconds: 0, duration: 0 })

  // Modal Spiking
  const [isSpikingOpen, setIsSpikingOpen] = useState(false)
  const spikingDialogRef = useRef<HTMLDivElement>(null)
  const [spikingContext, setSpikingContext] = useState("")
  const [customSpikingContext, setCustomSpikingContext] = useState("")
  const [selectedSpikingChunks, setSelectedSpikingChunks] = useState<string[]>([])
  const [spikingAudioUrl, setSpikingAudioUrl] = useState<string | null>(null)
  const [spikingAudioReviewed, setSpikingAudioReviewed] = useState(false)
  const spikingPlaybackRef = useRef<AudioPlaybackProgress>({ lastTime: 0, playedSeconds: 0, duration: 0 })
  const [spikingError, setSpikingError] = useState("")
  const [isSpikingRecording, setIsSpikingRecording] = useState(false)
  const [isSpikingStarting, setIsSpikingStarting] = useState(false)
  const [spikingSeconds, setSpikingSeconds] = useState(0)
  const spikingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const spikingMediaRecorderRef = useRef<MediaRecorder | null>(null)
  const spikingRequestIdRef = useRef(0)
  const spikingStartingRef = useRef(false)

  // Modal Immersing
  const [isImmersingOpen, setIsImmersingOpen] = useState(false)
  const immersingDialogRef = useRef<HTMLDivElement>(null)
  const [immersingElapsedSeconds, setImmersingElapsedSeconds] = useState(0)
  const [immersingAccumulatedSeconds, setImmersingAccumulatedSeconds] = useState(0)
  const [immersingStartedAt, setImmersingStartedAt] = useState<number | null>(null)

  // Grabación de voz en Shadowing
  const [isRecording, setIsRecording] = useState(false)
  const [isRecordingStarting, setIsRecordingStarting] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingRequestIdRef = useRef(0)
  const recordingStartingRef = useRef(false)

  // Hábitos diarios
  const [dailyHabits, setDailyHabits] = useState({
    raining: false,
    shadowing: false,
    shower: false,
    passive: false
  })

  const todayKey = getLocalDateKey()
  const shadowingProgressKey = `0v1m_shadowing_${userId ?? "guest"}_${todayKey}`
  const immersingTimerKey = `0v1m_immersing_${userId ?? "guest"}_${todayKey}`

  useEffect(() => {
    const dialog = onboardingStep === 1
      ? admissionDialogRef.current
      : onboardingStep === 2
        ? navigationDialogRef.current
        : isClosureReportOpen
          ? closureReportDialogRef.current
          : isSynapsingOpen
            ? synapsingDialogRef.current
            : isShadowingOpen
              ? shadowingDialogRef.current
              : isSpikingOpen
                ? spikingDialogRef.current
                : isImmersingOpen
                  ? immersingDialogRef.current
                  : null

    if (!dialog) return

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    dialog.focus()

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.getClientRects().length > 0)

      if (focusableElements.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    dialog.addEventListener("keydown", handleTabKey)
    return () => {
      dialog.removeEventListener("keydown", handleTabKey)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [onboardingStep, isClosureReportOpen, isSynapsingOpen, isShadowingOpen, isSpikingOpen, isImmersingOpen])

  const markItemAsPracticed = (id: string) => {
    if (practicedIds.includes(id)) return
    const nextIds = [...practicedIds, id]
    window.localStorage.setItem(shadowingProgressKey, JSON.stringify(nextIds))
    setPracticedIds(nextIds)
    setPracticedItemsCount(nextIds.length)
  }

  const trackAudioPlayback = (event: SyntheticEvent<HTMLAudioElement>, progress: AudioPlaybackProgress) => {
    const audio = event.currentTarget
    const currentTime = audio.currentTime
    if (!audio.seeking && !audio.paused && currentTime > progress.lastTime) {
      const elapsed = currentTime - progress.lastTime
      progress.playedSeconds += elapsed
    }
    progress.lastTime = currentTime
    if (Number.isFinite(audio.duration)) progress.duration = audio.duration
  }

  const resetAudioPlayback = (progress: AudioPlaybackProgress) => {
    progress.lastTime = 0
    progress.playedSeconds = 0
    progress.duration = 0
  }

  const hasHeardMostOfRecording = (progress: AudioPlaybackProgress) =>
    progress.duration > 0 && progress.playedSeconds >= progress.duration * 0.9

  const beginAudioPlayback = (event: SyntheticEvent<HTMLAudioElement>, progress: AudioPlaybackProgress) => {
    const audio = event.currentTarget
    if (audio.ended || audio.currentTime === 0) progress.playedSeconds = 0
    progress.lastTime = audio.currentTime
    if (Number.isFinite(audio.duration)) progress.duration = audio.duration
  }

  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-US"
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }

  const startRecording = async () => {
    if (recordingStartingRef.current || mediaRecorderRef.current?.state === "recording") return
    const selectedItemForPractice = filteredSynapses.find((item) => item.id === selectedItemForPracticeId) ?? filteredSynapses[0]
    if (!selectedItemForPractice?.id) {
      setActionError("Elige un chunk antes de grabar su práctica.")
      return
    }
    setActionError("")
    setShadowingError("")
    setShadowingAudioReviewed(false)
    resetAudioPlayback(shadowingPlaybackRef.current)
    setRecordingItemId(selectedItemForPractice.id)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    recordingStartingRef.current = true
    setIsRecordingStarting(true)
    const requestId = ++recordingRequestIdRef.current
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (requestId !== recordingRequestIdRef.current || !isShadowingOpen) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const audioChunks: Blob[] = []
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data)
      }

      recorder.onstop = () => {
        if (requestId !== recordingRequestIdRef.current) return
        const audioBlob = new Blob(audioChunks, {
          type: audioChunks[0]?.type || recorder.mimeType || "",
        })
        if (audioBlob.size === 0) {
          setShadowingError("No se recibió audio. Revisa el permiso del micrófono e inténtalo de nuevo.")
          return
        }
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)
      }

      recorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error("Error al acceder al micrófono:", err)
      if (requestId === recordingRequestIdRef.current) {
        setRecordingItemId(null)
        setShadowingError("No pudimos acceder al micrófono. Concede el permiso en el navegador e inténtalo de nuevo.")
      }
    } finally {
      if (requestId === recordingRequestIdRef.current) {
        recordingStartingRef.current = false
        setIsRecordingStarting(false)
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
      setIsRecording(false)
    }
  }

  const closeShadowingSession = () => {
    recordingRequestIdRef.current += 1
    recordingStartingRef.current = false
    setIsRecordingStarting(false)
    const recorder = mediaRecorderRef.current
    if (recorder) {
      recorder.onstop = null
      recorder.ondataavailable = null
      if (recorder.state !== "inactive") recorder.stop()
      recorder.stream.getTracks().forEach((track) => track.stop())
      mediaRecorderRef.current = null
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setRecordingItemId(null)
    setShadowingAudioReviewed(false)
    setShadowingError("")
    resetAudioPlayback(shadowingPlaybackRef.current)
    setIsRecording(false)
    setIsShadowingOpen(false)
  }

  const discardSpikingTake = () => {
    if (spikingAudioUrl) URL.revokeObjectURL(spikingAudioUrl)
    setSpikingAudioUrl(null)
    setSpikingAudioReviewed(false)
    setSpikingError("")
    resetAudioPlayback(spikingPlaybackRef.current)
  }

  const startSpikingRecording = async () => {
    if (spikingStartingRef.current || spikingMediaRecorderRef.current?.state === "recording") return
    if (selectedSpikingChunks.length === 0) {
      setSpikingError("Selecciona al menos un chunk para empezar el sparring.")
      return
    }

    discardSpikingTake()
    spikingStartingRef.current = true
    setIsSpikingStarting(true)
    const requestId = ++spikingRequestIdRef.current
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (requestId !== spikingRequestIdRef.current || !isSpikingOpen) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const audioChunks: Blob[] = []
      const recorder = new MediaRecorder(stream)
      spikingMediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data)
      }

      recorder.onstop = () => {
        if (requestId !== spikingRequestIdRef.current) return
        const audioBlob = new Blob(audioChunks, {
          type: audioChunks[0]?.type || recorder.mimeType || "",
        })
        if (audioBlob.size === 0) {
          setSpikingError("No se recibió audio. Revisa el permiso del micrófono e inténtalo de nuevo.")
          return
        }
        const url = URL.createObjectURL(audioBlob)
        setSpikingAudioUrl(url)
      }

      recorder.start()
      setIsSpikingRecording(true)
      setSpikingSeconds(0)

      spikingTimerRef.current = setInterval(() => {
        setSpikingSeconds(prev => prev + 1)
      }, 1000)

    } catch (err) {
      console.error("Error al acceder al micrófono en Spiking:", err)
      if (requestId === spikingRequestIdRef.current) {
        setSpikingError("No pudimos acceder al micrófono. Concede el permiso en el navegador e inténtalo de nuevo.")
      }
    } finally {
      if (requestId === spikingRequestIdRef.current) {
        spikingStartingRef.current = false
        setIsSpikingStarting(false)
      }
    }
  }

  const stopSpikingRecording = () => {
    if (spikingMediaRecorderRef.current && isSpikingRecording) {
      spikingMediaRecorderRef.current.stop()
      spikingMediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
      setIsSpikingRecording(false)
      if (spikingTimerRef.current) clearInterval(spikingTimerRef.current)
    }
  }

  const closeSpikingSession = () => {
    spikingRequestIdRef.current += 1
    spikingStartingRef.current = false
    setIsSpikingStarting(false)
    const recorder = spikingMediaRecorderRef.current
    if (recorder) {
      recorder.onstop = null
      recorder.ondataavailable = null
      if (recorder.state !== "inactive") recorder.stop()
      recorder.stream.getTracks().forEach((track) => track.stop())
      spikingMediaRecorderRef.current = null
    }
    if (spikingTimerRef.current) clearInterval(spikingTimerRef.current)
    spikingTimerRef.current = null
    if (spikingAudioUrl) URL.revokeObjectURL(spikingAudioUrl)
    setSpikingAudioUrl(null)
    setSpikingAudioReviewed(false)
    resetAudioPlayback(spikingPlaybackRef.current)
    setIsSpikingRecording(false)
    setSpikingSeconds(0)
    setSpikingError("")
    setSelectedSpikingChunks([])
    setIsSpikingOpen(false)
  }

  const beginImmersingTimer = () => {
    const startedAt = Date.now()
    setImmersingStartedAt(startedAt)
    window.localStorage.setItem(
      immersingTimerKey,
      JSON.stringify({ accumulatedSeconds: immersingAccumulatedSeconds, startedAt })
    )
  }

  const pauseImmersingTimer = () => {
    if (immersingStartedAt === null) return
    const elapsed = immersingAccumulatedSeconds + Math.floor((Date.now() - immersingStartedAt) / 1000)
    setImmersingAccumulatedSeconds(elapsed)
    setImmersingElapsedSeconds(elapsed)
    setImmersingStartedAt(null)
    window.localStorage.setItem(
      immersingTimerKey,
      JSON.stringify({ accumulatedSeconds: elapsed, startedAt: null })
    )
  }

  useEffect(() => {
    return () => {
      recordingRequestIdRef.current += 1
      recordingStartingRef.current = false
      spikingRequestIdRef.current += 1
      spikingStartingRef.current = false
      if (spikingTimerRef.current) clearInterval(spikingTimerRef.current)
      for (const recorder of [mediaRecorderRef.current, spikingMediaRecorderRef.current]) {
        if (!recorder) continue
        recorder.onstop = null
        recorder.ondataavailable = null
        if (recorder.state !== "inactive") recorder.stop()
        recorder.stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      const nextUserId = user?.id ?? null
      const previousUserId = authUserIdRef.current
      if (previousUserId && previousUserId !== nextUserId) {
        setSynapses([])
        setDailyHabits({ raining: false, shadowing: false, shower: false, passive: false })
        setUserLevel("B1")
        setPracticedIds([])
        setPracticedItemsCount(0)
        setSelectedItemForPracticeId(null)
        setImmersingElapsedSeconds(0)
        setImmersingAccumulatedSeconds(0)
        setImmersingStartedAt(null)
        setOnboardingStep(0)
      }
      authUserIdRef.current = nextUserId
      setUserId(nextUserId)
      setAuthStatus(user ? "signed-in" : "signed-out")
      if (user) {
        const onboardingDone = localStorage.getItem(`0v1m_onboarding_seen_${user.id}`)
        if (!onboardingDone) setOnboardingStep(1)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (authStatus !== "signed-in" || !userId) return
    let cancelled = false

    async function loadInitialData() {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("current_mcer_level")
        .eq("id", userId)
        .maybeSingle()

      if (cancelled) return
      if (profileError) {
        console.error("No se pudo cargar el nivel del perfil:", profileError)
      } else if (profileData?.current_mcer_level) {
        setUserLevel(profileData.current_mcer_level)
      } else {
        const savedLevel = localStorage.getItem(`0v1m_level_${userId}`)
        if (savedLevel && MCER_CONTEXTS[savedLevel]) setUserLevel(savedLevel)
      }

      const { data: habitData, error: habitError } = await supabase
        .from("user_habits")
        .select("raining, shadowing, shower, passive")
        .eq("user_id", userId)
        .eq("habit_date", todayKey)
        .maybeSingle()

      if (cancelled) return
      if (habitError) {
        setActionError("No se pudo recuperar el progreso de hoy. Vuelve a cargar la página o avisa al equipo.")
      } else if (habitData) {
        setDailyHabits(habitData)
      }

      try {
        const items = await getSynapseItems()
        if (!cancelled) setSynapses(items)
      } catch (error) {
        console.error("No se pudieron cargar los chunks:", error)
        if (!cancelled) setActionError("No se pudo cargar el banco de chunks.")
      }
    }

    void loadInitialData()
    return () => { cancelled = true }
  }, [authStatus, supabase, todayKey, userId])

  useEffect(() => {
    let cancelled = false
    try {
      const storedIds = JSON.parse(window.localStorage.getItem(shadowingProgressKey) || "[]")
      if (Array.isArray(storedIds) && storedIds.every((id) => typeof id === "string")) {
        window.setTimeout(() => {
          if (cancelled) return
          setPracticedIds(storedIds)
          setPracticedItemsCount(storedIds.length)
        }, 0)
      }
    } catch {
      window.localStorage.removeItem(shadowingProgressKey)
      window.setTimeout(() => {
        if (cancelled) return
        setPracticedIds([])
        setPracticedItemsCount(0)
      }, 0)
    }
    return () => { cancelled = true }
  }, [shadowingProgressKey])

  useEffect(() => {
    const storedTimer = window.localStorage.getItem(immersingTimerKey)
    let next = { elapsed: 0, accumulated: 0, startedAt: null as number | null }

    if (storedTimer) {
      try {
        const parsed = JSON.parse(storedTimer) as { accumulatedSeconds?: number; startedAt?: number | null }
        const accumulated = Math.max(0, Number(parsed.accumulatedSeconds) || 0)
        const startedAt = typeof parsed.startedAt === "number" ? parsed.startedAt : null
        next = {
          elapsed: accumulated + (startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0),
          accumulated,
          startedAt,
        }
      } catch {
        window.localStorage.removeItem(immersingTimerKey)
      }
    }
    window.setTimeout(() => {
      setImmersingAccumulatedSeconds(next.accumulated)
      setImmersingStartedAt(next.startedAt)
      setImmersingElapsedSeconds(next.elapsed)
    }, 0)
  }, [immersingTimerKey])

  useEffect(() => {
    if (immersingStartedAt === null) return
    const timer = window.setInterval(() => {
      setImmersingElapsedSeconds(
        immersingAccumulatedSeconds + Math.floor((Date.now() - immersingStartedAt) / 1000)
      )
    }, 1000)
    return () => window.clearInterval(timer)
  }, [immersingAccumulatedSeconds, immersingStartedAt])

  useEffect(() => {
    if (immersingStartedAt === null) return
    const pauseOnPageExit = () => {
      const elapsed = immersingAccumulatedSeconds + Math.floor((Date.now() - immersingStartedAt) / 1000)
      window.localStorage.setItem(
        immersingTimerKey,
        JSON.stringify({ accumulatedSeconds: elapsed, startedAt: null })
      )
    }
    window.addEventListener("pagehide", pauseOnPageExit)
    return () => window.removeEventListener("pagehide", pauseOnPageExit)
  }, [immersingAccumulatedSeconds, immersingStartedAt, immersingTimerKey])

  useEffect(() => {
    if (authStatus !== "signed-in") return
    let cancelled = false
    async function loadChunks() {
      try {
        const chunks = await getSuggestedChunks(userLevel)
        if (!cancelled) setSuggestedChunks(chunks)
      } catch (error) {
        console.error("No se pudieron cargar las sugerencias:", error)
        if (!cancelled) setActionError("No se pudieron cargar las sugerencias para tu nivel.")
      }
    }
    loadChunks()
    return () => { cancelled = true }
  }, [authStatus, userLevel])

  const handleLevelChange = (newLevel: string) => {
    setUserLevel(newLevel)
    window.localStorage.setItem(`0v1m_level_${userId ?? "guest"}`, newLevel)
    startTransition(async () => {
      try {
        const updatedProfile = await updateUserProfileLevel(newLevel)
        if (!updatedProfile) {
          setActionError("El nivel se guardó en este dispositivo, pero no pudimos sincronizarlo con tu perfil.")
        } else {
          setActionError("")
        }
      } catch (error) {
        console.error(error)
        setActionError("El nivel se guardó en este dispositivo, pero no pudimos sincronizarlo con tu perfil.")
      }
    })
  }

  const saveHabitToCloud = async (updated: typeof dailyHabits) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      setActionError("Tu sesión terminó. Vuelve a entrar para guardar el progreso.")
      return false
    }

    const { error } = await supabase
      .from("user_habits")
      .upsert(
        {
          user_id: user.id,
          habit_date: todayKey,
          raining: updated.raining,
          shadowing: updated.shadowing,
          shower: updated.shower,
          passive: updated.passive,
        },
        { onConflict: "user_id,habit_date" }
      )

    if (error) {
      console.error("No se pudo guardar el progreso diario:", error)
      setActionError("No pudimos guardar el progreso. Comprueba tu conexión e inténtalo de nuevo.")
      return false
    }

    setActionError("")
    setDailyHabits(updated)

    const completedCount = Object.values(updated).filter(Boolean).length
    if (completedCount === 4) {
      setIsClosureReportOpen(true)
    }
    return true
  }

  const handleCompleteSynapsing = async () => {
    if (synapsingChunksToday < 5) return
    const updated = { ...dailyHabits, raining: true }
    if (await saveHabitToCloud(updated)) setIsSynapsingOpen(false)
  }

  const handleCompleteShadowing = async () => {
    if (practicedItemsCount < 5 || isRecording) return
    const updated = { ...dailyHabits, shadowing: true }
    if (await saveHabitToCloud(updated)) {
      setIsShadowingOpen(false)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
      setRecordingItemId(null)
      setShadowingAudioReviewed(false)
    }
  }

  const handleCompleteSpiking = async () => {
    if (selectedSpikingChunks.length === 0 || !spikingAudioUrl || !spikingAudioReviewed || isSpikingRecording) {
      setSpikingError("Selecciona al menos un chunk, graba el sparring y escucha tu grabación antes de completar.")
      return
    }
    const updated = { ...dailyHabits, shower: true }
    if (await saveHabitToCloud(updated)) {
      setIsSpikingOpen(false)
      if (spikingAudioUrl) URL.revokeObjectURL(spikingAudioUrl)
      setSpikingAudioUrl(null)
      setSpikingAudioReviewed(false)
      setSpikingSeconds(0)
      setSelectedSpikingChunks([])
    }
  }

  const handleCompleteImmersing = async () => {
    if (immersingStartedAt !== null || immersingElapsedSeconds < 45 * 60) return
    const updated = { ...dailyHabits, passive: true }
    if (await saveHabitToCloud(updated)) setIsImmersingOpen(false)
  }

  const handleMagicLinkSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginError("")
    setLoginMessage("")
    setIsLoginPending(true)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: loginEmail.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) throw error
      setLoginMessage("Si esta dirección tiene una cuenta de evaluador habilitada, recibirás un enlace para entrar.")
    } catch (error) {
      console.error("No se pudo solicitar el enlace de acceso:", error)
      setLoginError("No pudimos enviar el enlace. Revisa la dirección o contacta al equipo del piloto.")
    } finally {
      setIsLoginPending(false)
    }
  }

  const handleSignOut = async () => {
    closeShadowingSession()
    closeSpikingSession()
    const { error } = await supabase.auth.signOut()
    if (error) setActionError("No pudimos cerrar la sesión. Inténtalo de nuevo.")
  }

  const finishOnboarding = () => {
    if (userId) localStorage.setItem(`0v1m_onboarding_seen_${userId}`, "true")
    setOnboardingStep(0)
  }

  const totalCompleted = Object.values(dailyHabits).filter(Boolean).length
  const synapsingChunksToday = new Set(
    synapses
      .filter((item) => item.created_at && getLocalDateKey(new Date(item.created_at)) === todayKey)
      .map((item) => item.source_text.trim().toLocaleLowerCase().replace(/\s+/g, " "))
      .filter(Boolean)
  ).size
  const visibleSuggestedChunks = suggestedChunks
    .map((item) => ({ item, source: getChunkSource(item), target: getChunkTarget(item) }))
    .filter((entry) => entry.source && entry.target)
    .slice(0, 5)

  const filteredSynapses = synapses.filter((item) => {
    const dbCat = (item.category || "chunk").toLowerCase().trim()
    const targetCat = "chunk"
    return dbCat === targetCat
  })

  const selectedItemForPractice = filteredSynapses.find((item) => item.id === selectedItemForPracticeId) ?? filteredSynapses[0] ?? null

  const toggleSpikingChunkSelect = (text: string) => {
    if (isSpikingRecording || isSpikingStarting) return
    discardSpikingTake()
    if (selectedSpikingChunks.includes(text)) {
      setSelectedSpikingChunks(selectedSpikingChunks.filter(t => t !== text))
    } else {
      setSelectedSpikingChunks([...selectedSpikingChunks, text])
    }
  }

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60)
    const secs = totalSecs % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatDuration = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600)
    const mins = Math.floor((totalSecs % 3600) / 60)
    const secs = totalSecs % 60
    return hours > 0
      ? `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      : `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  if (authStatus === "loading") {
    return (
      <main className="min-h-screen bg-[#050b05] text-slate-100 flex items-center justify-center p-6">
        <p role="status" className="text-sm text-emerald-300">Cargando tu sesión…</p>
      </main>
    )
  }

  if (authStatus === "signed-out") {
    return (
      <main className="min-h-screen bg-[#050b05] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
        <section className="w-full max-w-md rounded-2xl border border-emerald-900 bg-[#081208] p-6 sm:p-8 shadow-2xl space-y-5">
          <header className="space-y-2 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Acceso de evaluadores</p>
            <h1 className="text-3xl font-extrabold text-white">0V1M System</h1>
            <p className="text-sm leading-relaxed text-slate-300">Escribe el correo de la cuenta que te asignó el equipo. Te enviaremos un enlace de acceso de un solo uso.</p>
          </header>
          <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
            <label className="block space-y-2 text-sm text-slate-200">
              <span>Correo de evaluador</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                className="w-full rounded-lg border border-emerald-900 bg-[#050b05] px-3 py-3 text-white outline-none focus:border-emerald-400"
                placeholder="tu-correo@ejemplo.com"
              />
            </label>
            <button
              type="submit"
              disabled={isLoginPending}
              className="w-full rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
            >
              {isLoginPending ? "Enviando enlace…" : "Enviar enlace de acceso"}
            </button>
          </form>
          {loginMessage && <p role="status" className="rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">{loginMessage}</p>}
          {loginError && <p role="alert" className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{loginError}</p>}
          <p className="text-center text-xs leading-relaxed text-slate-500">El acceso solo funciona con cuentas previamente habilitadas para el piloto.</p>
        </section>
      </main>
    )
  }

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#050b05", color: "#e5e7eb", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      
      {/* ONBOARDING 1: MI COMPROMISO DE ADMISIÓN */}
      {onboardingStep === 1 && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 50 }}>
          <div ref={admissionDialogRef} role="dialog" aria-modal="true" aria-labelledby="admission-dialog-title" tabIndex={-1} style={{ backgroundColor: "#081208", border: "1px solid #065f46", borderRadius: "16px", width: "100%", maxWidth: "500px", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ borderBottom: "1px solid #052e16", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 id="admission-dialog-title" style={{ fontSize: "14px", fontWeight: "bold", color: "#34d399", textTransform: "uppercase" }}>⚠️ MI COMPROMISO de Admisión</h3>
            </div>
            <p style={{ fontSize: "12px", color: "#d1d5db", lineHeight: "1.6" }}>
              Estás a punto de cruzar un umbral. Este sistema exige disciplina y la firme decisión de transformar tu rendimiento lingüístico diario.
            </p>
            <button
              onClick={() => setOnboardingStep(2)}
              style={{ width: "100%", backgroundColor: "#10b981", color: "#000", fontWeight: "bold", padding: "12px", borderRadius: "12px", fontSize: "12px", textTransform: "uppercase", cursor: "pointer" }}
            >
              Asumo el Reto / Siguiente
            </button>
          </div>
        </div>
      )}

      {/* ONBOARDING 2: MANUAL OPERATIVO Y CIENTÍFICO (INTERACTIVO) */}
      {onboardingStep === 2 && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 50 }}>
          <div ref={navigationDialogRef} role="dialog" aria-modal="true" aria-labelledby="navigation-dialog-title" tabIndex={-1} style={{ backgroundColor: "#081208", border: "1px solid #065f46", borderRadius: "16px", width: "100%", maxWidth: "600px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ borderBottom: "1px solid #052e16", paddingBottom: "12px" }}>
              <h3 id="navigation-dialog-title" style={{ fontSize: "14px", fontWeight: "bold", color: "#34d399", textTransform: "uppercase" }}>📖 Manual de Navegación y Fundamento del Método</h3>
              <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>Abre cada estación para conocer sus pasos y la propuesta del método:</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "11px", color: "#d1d5db" }}>
              
              {/* 1. SYNAPSING */}
              <div style={{ backgroundColor: "#0b160b", padding: "12px", borderRadius: "8px", border: `1px solid ${expandedOnboardingCard === 'synapsing' ? '#10b981' : '#052e16'}` }}>
                <button type="button" aria-expanded={expandedOnboardingCard === 'synapsing'} onClick={() => setExpandedOnboardingCard(expandedOnboardingCard === 'synapsing' ? null : 'synapsing')} className="w-full rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: 0, padding: 0, cursor: "pointer", color: "inherit" }}>
                  <b style={{ color: "#34d399" }}>🌧️ Synapsing (Estación Auditiva)</b>
                  <span style={{ fontSize: "10px", color: "#10b981", fontFamily: "monospace" }}>{expandedOnboardingCard === 'synapsing' ? '▲ Ocultar detalles' : '▼ Ver fundamento del ejercicio'}</span>
                </button>
                <p style={{ color: "#9ca3af", marginTop: "4px" }}><b>Operación:</b> Entra a plataformas de streaming o Radio Garden, escucha contenido nativo y registra abajo las frases o &quot;chunks&quot; con su significado.</p>
                
                {expandedOnboardingCard === 'synapsing' && (
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #052e16", color: "#d1d5db", lineHeight: "1.5", fontSize: "11px" }}>
                    <p style={{ color: "#34d399", fontWeight: "bold", marginBottom: "4px" }}>🧠 Propuesta del método:</p>
                    <p>La propuesta es asociar lo que escuchas con su significado y guardar ejemplos auténticos para reutilizarlos. En esta prueba observaremos si registrar frases en contexto facilita encontrarlas y practicarlas después.</p>
                  </div>
                )}
              </div>

              {/* 2. SHADOWING */}
              <div style={{ backgroundColor: "#0b160b", padding: "12px", borderRadius: "8px", border: `1px solid ${expandedOnboardingCard === 'shadowing' ? '#10b981' : '#052e16'}` }}>
                <button type="button" aria-expanded={expandedOnboardingCard === 'shadowing'} onClick={() => setExpandedOnboardingCard(expandedOnboardingCard === 'shadowing' ? null : 'shadowing')} className="w-full rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: 0, padding: 0, cursor: "pointer", color: "inherit" }}>
                  <b style={{ color: "#34d399" }}>🎙️ Shadowing (Musculación Oral)</b>
                  <span style={{ fontSize: "10px", color: "#10b981", fontFamily: "monospace" }}>{expandedOnboardingCard === 'shadowing' ? '▲ Ocultar detalles' : '▼ Ver fundamento del ejercicio'}</span>
                </button>
                <p style={{ color: "#9ca3af", marginTop: "4px" }}><b>Operación:</b> Escucha la pronunciación nativa de tus chunks guardados y grábate imitando el sonido exacto hasta cumplir la meta diaria.</p>
                
                {expandedOnboardingCard === 'shadowing' && (
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #052e16", color: "#d1d5db", lineHeight: "1.5", fontSize: "11px" }}>
                    <p style={{ color: "#34d399", fontWeight: "bold", marginBottom: "4px" }}>🧠 Propuesta del método:</p>
                    <p>Escuchar el modelo, imitarlo y grabarte te permite comparar tu producción con el audio de referencia. En esta prueba se usa TTS genérico; la app no analiza automáticamente la pronunciación.</p>
                  </div>
                )}
              </div>

              {/* 3. SPIKING */}
              <div style={{ backgroundColor: "#0b160b", padding: "12px", borderRadius: "8px", border: `1px solid ${expandedOnboardingCard === 'spiking' ? '#10b981' : '#052e16'}` }}>
                <button type="button" aria-expanded={expandedOnboardingCard === 'spiking'} onClick={() => setExpandedOnboardingCard(expandedOnboardingCard === 'spiking' ? null : 'spiking')} className="w-full rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: 0, padding: 0, cursor: "pointer", color: "inherit" }}>
                  <b style={{ color: "#34d399" }}>⚡ Spiking (Producción Oral)</b>
                  <span style={{ fontSize: "10px", color: "#10b981", fontFamily: "monospace" }}>{expandedOnboardingCard === 'spiking' ? '▲ Ocultar detalles' : '▼ Ver fundamento del ejercicio'}</span>
                </button>
                <p style={{ color: "#9ca3af", marginTop: "4px" }}><b>Operación:</b> Selecciona un contexto real, carga tus chunks como munición y realiza tu simulacro de conversación grabándote.</p>
                
                {expandedOnboardingCard === 'spiking' && (
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #052e16", color: "#d1d5db", lineHeight: "1.5", fontSize: "11px" }}>
                    <p style={{ color: "#34d399", fontWeight: "bold", marginBottom: "4px" }}>🧠 Propuesta del método:</p>
                    <p>El ejercicio plantea recuperar chunks en un contexto imaginado y sostener una intervención en voz alta. La app conserva la grabación para que la escuches; no evalúa automáticamente precisión ni fluidez.</p>
                  </div>
                )}
              </div>

              {/* 4. IMMERSING */}
              <div style={{ backgroundColor: "#0b160b", padding: "12px", borderRadius: "8px", border: `1px solid ${expandedOnboardingCard === 'immersing' ? '#10b981' : '#052e16'}` }}>
                <button type="button" aria-expanded={expandedOnboardingCard === 'immersing'} onClick={() => setExpandedOnboardingCard(expandedOnboardingCard === 'immersing' ? null : 'immersing')} className="w-full rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: 0, padding: 0, cursor: "pointer", color: "inherit" }}>
                  <b style={{ color: "#34d399" }}>🥤 Immersing (Nutrición y Recuperación)</b>
                  <span style={{ fontSize: "10px", color: "#10b981", fontFamily: "monospace" }}>{expandedOnboardingCard === 'immersing' ? '▲ Ocultar detalles' : '▼ Ver fundamento del ejercicio'}</span>
                </button>
                <p style={{ color: "#9ca3af", marginTop: "4px" }}><b>Operación:</b> Disfruta de 45 a 60 minutos de contenido en inglés de tu elección y registra el tiempo de sesión.</p>
                
                {expandedOnboardingCard === 'immersing' && (
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #052e16", color: "#d1d5db", lineHeight: "1.5", fontSize: "11px" }}>
                    <p style={{ color: "#34d399", fontWeight: "bold", marginBottom: "4px" }}>🧠 Propuesta del método:</p>
                    <p>El método reserva un bloque para consumir inglés que disfrutas, con menor carga de análisis. El contador registra tiempo declarado: no detecta la reproducción ni mide cambios en el aprendizaje.</p>
                  </div>
                )}
              </div>

            </div>

            <button
              onClick={finishOnboarding}
              style={{ width: "100%", backgroundColor: "#10b981", color: "#000", fontWeight: "bold", padding: "12px", borderRadius: "12px", fontSize: "12px", textTransform: "uppercase", cursor: "pointer", marginTop: "6px" }}
            >
              Comprendido / Iniciar Programa
            </button>
          </div>
        </div>
      )}

      {/* REPORTE DE CIERRE DE SESIÓN */}
      {isClosureReportOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 60 }}>
          <div ref={closureReportDialogRef} role="dialog" aria-modal="true" aria-labelledby="closure-report-title" tabIndex={-1} style={{ backgroundColor: "#081208", border: "2px solid #10b981", borderRadius: "16px", width: "100%", maxWidth: "500px", padding: "28px", display: "flex", flexDirection: "column", gap: "20px", boxShadow: "0 0 40px rgba(16,185,129,0.2)" }}>
            <div style={{ borderBottom: "1px solid #052e16", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 id="closure-report-title" style={{ fontSize: "15px", fontWeight: "bold", color: "#34d399", textTransform: "uppercase" }}>🏆 Reporte de Cierre de Sesión</h3>
              <span style={{ fontSize: "11px", backgroundColor: "#022c22", color: "#34d399", border: "1px solid #065f46", padding: "2px 8px", borderRadius: "6px" }}>Protocolo Diario Exitoso</span>
            </div>

            <div style={{ fontSize: "12px", color: "#d1d5db", lineHeight: "1.6" }}>
              <p style={{ marginBottom: "10px" }}>
                ¡Excelente trabajo! Has completado las <strong>4 estaciones de entrenamiento</strong> de hoy.
              </p>
              
                <div style={{ backgroundColor: "#0b160b", padding: "14px", borderRadius: "10px", border: "1px solid #052e16", display: "grid", gridTemplateColumns: "1fr", gap: "10px", textAlign: "center" }}>
                <div>
                  <span style={{ fontSize: "10px", color: "#9ca3af", display: "block" }}>ESTACIONES</span>
                  <span style={{ fontSize: "16px", fontWeight: "bold", color: "#34d399" }}>4 / 4</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsClosureReportOpen(false)}
              style={{ width: "100%", backgroundColor: "#10b981", color: "#000", fontWeight: "bold", padding: "12px", borderRadius: "12px", fontSize: "12px", textTransform: "uppercase", cursor: "pointer" }}
            >
              Finalizar Jornada y Salir
            </button>
          </div>
        </div>
      )}

      <div style={{ width: "100%", maxWidth: "650px", display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Cabecera */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #052e16", paddingBottom: "12px" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "bold", color: "#10b981" }}>0V1M System</h1>
            <p style={{ fontSize: "11px", color: "#9ca3af" }}>Cuenta personal de evaluador</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={() => setOnboardingStep(2)} style={{ fontSize: "10px", color: "#34d399", background: "none", border: "1px solid #052e16", padding: "4px 8px", borderRadius: "6px", cursor: "pointer" }}>ℹ️ MI COMPROMISO</button>
            {totalCompleted === 4 && (
              <button onClick={() => setIsClosureReportOpen(true)} style={{ fontSize: "10px", color: "#000", backgroundColor: "#34d399", border: "none", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>🏆 Ver Reporte</button>
            )}
            <button onClick={handleSignOut} style={{ background: "none", border: "1px solid #052e16", color: "#9ca3af", padding: "4px 8px", borderRadius: "6px", fontSize: "10px", cursor: "pointer" }}>Cerrar sesión</button>
          </div>
        </div>

        {actionError && (
          <p role="alert" style={{ border: "1px solid #7f1d1d", backgroundColor: "#2a0d0d", color: "#fecaca", borderRadius: "8px", padding: "10px 12px", fontSize: "12px" }}>
            {actionError}
          </p>
        )}

        {/* 4 SALAS DE ENTRENAMIENTO */}
        <div style={{ backgroundColor: "#081208", border: "1px solid #052e16", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "#34d399" }}>Protocolo Diario: 4 Salas de Entrenamiento</h2>
            <span style={{ fontSize: "11px", color: "#10b981", fontFamily: "monospace" }}>{totalCompleted} / 4 cumplidos</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={() => setIsSynapsingOpen(true)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", borderRadius: "8px", border: "1px solid #052e16", backgroundColor: dailyHabits.raining ? "#022c22" : "#0b160b", color: "#34d399", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontWeight: "600", fontSize: "12px" }}>🌧️ Synapsing (Estación de Neuromusculación Auditiva)</span>
              <span style={{ fontSize: "11px", fontWeight: "bold" }}>{dailyHabits.raining ? "✓ Hecho" : "▶ Iniciar Set"}</span>
            </button>

            <button onClick={() => setIsShadowingOpen(true)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", borderRadius: "8px", border: "1px solid #052e16", backgroundColor: dailyHabits.shadowing ? "#022c22" : "#0b160b", color: "#34d399", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontWeight: "600", fontSize: "12px" }}>🎙️ Shadowing (Sala de Musculación Oral)</span>
              <span style={{ fontSize: "11px", fontWeight: "bold" }}>{dailyHabits.shadowing ? "✓ Hecho" : "▶ Iniciar"}</span>
            </button>

            <button onClick={() => setIsSpikingOpen(true)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", borderRadius: "8px", border: "1px solid #052e16", backgroundColor: dailyHabits.shower ? "#022c22" : "#0b160b", color: "#34d399", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontWeight: "600", fontSize: "12px" }}>⚡ Spiking (Simulador de Producción Oral)</span>
              <span style={{ fontSize: "11px", fontWeight: "bold" }}>{dailyHabits.shower ? "✓ Hecho" : "▶ Iniciar"}</span>
            </button>

            <button onClick={() => setIsImmersingOpen(true)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", borderRadius: "8px", border: "1px solid #052e16", backgroundColor: dailyHabits.passive ? "#022c22" : "#0b160b", color: "#34d399", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontWeight: "600", fontSize: "12px" }}>🥤 Immersing (Punto de Nutrición y Recuperación)</span>
              <span style={{ fontSize: "11px", fontWeight: "bold" }}>{dailyHabits.passive ? "✓ Hecho" : "▶ Iniciar (45-60m)"}</span>
            </button>
          </div>
        </div>

        {/* Selector Táctico de Niveles */}
        <div style={{ backgroundColor: "#081208", border: "1px solid #052e16", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "#34d399" }}>Selector Táctico de Niveles</h2>
              <p style={{ fontSize: "10px", color: "#10b981" }}>Elige tu nivel target:</p>
            </div>
            <div style={{ display: "flex", gap: "4px", backgroundColor: "#0b160b", padding: "4px", borderRadius: "8px", border: "1px solid #052e16" }}>
              {["A1", "A2", "B1", "B2", "C1", "C2"].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => handleLevelChange(lvl)}
                  style={{ padding: "6px 10px", fontSize: "11px", fontWeight: "bold", borderRadius: "6px", backgroundColor: userLevel === lvl ? "#10b981" : "transparent", color: userLevel === lvl ? "#000" : "#9ca3af", border: "none", cursor: "pointer" }}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* MODAL 1: SYNAPSING */}
      {isSynapsingOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 50 }}>
          <div ref={synapsingDialogRef} role="dialog" aria-modal="true" aria-label="Sala Synapsing" tabIndex={-1} style={{ backgroundColor: "#081208", border: "1px solid #065f46", borderRadius: "16px", width: "100%", maxWidth: "550px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #052e16", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#34d399" }}>🌧️ Synapsing (Estación Auditiva)</h3>
              <button onClick={() => setIsSynapsingOpen(false)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>
            
            <button onClick={() => setIsSynapsingGuideOpen(!isSynapsingGuideOpen)} style={{ width: "100%", padding: "10px", backgroundColor: "#0b160b", border: "1px solid #052e16", color: "#34d399", fontSize: "11px", fontWeight: "bold", borderRadius: "8px", cursor: "pointer", textAlign: "left" }}>
              📖 {isSynapsingGuideOpen ? "▲ Ocultar Manual" : "▼ Ver Manual de Instrucciones"}
            </button>
            {isSynapsingGuideOpen && (
              <p style={{ fontSize: "11px", color: "#9ca3af", lineHeight: "1.5", backgroundColor: "#060e06", padding: "12px", borderRadius: "8px" }}>
                Captura los chunks que escuchas en series, películas o canciones con su significado y entrena tu cerebro asociando sonido y lectura.
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontFamily: "monospace", textTransform: "uppercase", color: "#10b981" }}>Fuentes de Captura (Streaming & Audio):</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <a href="https://radio.garden" target="_blank" rel="noopener noreferrer" style={{ backgroundColor: "#0b160b", border: "1px solid #052e16", padding: "8px 10px", borderRadius: "8px", fontSize: "11px", color: "#d1d5db", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📻</span> Radio Garden
                </a>
                <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" style={{ backgroundColor: "#0b160b", border: "1px solid #052e16", padding: "8px 10px", borderRadius: "8px", fontSize: "11px", color: "#d1d5db", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📺</span> YouTube
                </a>
                <a href="https://www.netflix.com" target="_blank" rel="noopener noreferrer" style={{ backgroundColor: "#0b160b", border: "1px solid #052e16", padding: "8px 10px", borderRadius: "8px", fontSize: "11px", color: "#d1d5db", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🎬</span> Netflix
                </a>
                <a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer" style={{ backgroundColor: "#0b160b", border: "1px solid #052e16", padding: "8px 10px", borderRadius: "8px", fontSize: "11px", color: "#d1d5db", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🎧</span> Spotify
                </a>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", backgroundColor: "#0b160b", padding: "12px", borderRadius: "10px", border: "1px solid #052e16" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "bold", color: "#34d399", textTransform: "uppercase" }}>Sugerencias para nivel {userLevel}</h4>
                <span style={{ fontSize: "10px", color: "#9ca3af" }}>{visibleSuggestedChunks.length} de 5 visibles</span>
              </div>
              <p style={{ fontSize: "11px", lineHeight: "1.4", color: "#9ca3af" }}>Puedes usar una sugerencia como punto de partida y corregirla según el contenido que escuchaste.</p>
              {visibleSuggestedChunks.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {visibleSuggestedChunks.map((entry, index) => (
                    <button
                      key={typeof entry.item.id === "string" ? entry.item.id : `${entry.source}-${index}`}
                      type="button"
                      onClick={() => { setSourceText(entry.source); setTargetText(entry.target) }}
                      style={{ textAlign: "left", backgroundColor: "#081208", border: "1px solid #052e16", borderRadius: "7px", padding: "8px", color: "#d1d5db", cursor: "pointer", fontSize: "11px" }}
                    >
                      <strong style={{ color: "#34d399" }}>{entry.source}</strong>
                      <span style={{ display: "block", color: "#9ca3af", marginTop: "3px" }}>{entry.target}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "11px", color: "#fbbf24" }}>No encontramos sugerencias disponibles para este nivel. Puedes registrar chunks de la fuente que estés escuchando.</p>
              )}
            </div>

            <p style={{ fontSize: "12px", color: synapsingChunksToday >= 5 ? "#34d399" : "#fbbf24" }}>
              Chunks nuevos guardados hoy: <strong>{synapsingChunksToday} / 5</strong> (mínimo para completar)
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", backgroundColor: "#0b160b", padding: "16px", borderRadius: "12px", border: "1px solid #052e16" }}>
              <h4 style={{ fontSize: "11px", fontWeight: "bold", color: "#34d399", textTransform: "uppercase" }}>Registrar Nuevo Chunk</h4>
              <input type="text" value={sourceText} onChange={(e) => setSourceText(e.target.value)} placeholder="Frase en inglés (Source)" style={{ width: "100%", backgroundColor: "#081208", border: "1px solid #052e16", borderRadius: "8px", padding: "10px", fontSize: "12px", color: "#e5e7eb" }} />
              <input type="text" value={targetText} onChange={(e) => setTargetText(e.target.value)} placeholder="Traducción en español (Target)" style={{ width: "100%", backgroundColor: "#081208", border: "1px solid #052e16", borderRadius: "8px", padding: "10px", fontSize: "12px", color: "#e5e7eb" }} />
              <button onClick={async () => {
                if (!sourceText.trim() || !targetText.trim()) {
                  setActionError("Completa la frase en inglés y su significado antes de guardar.")
                  return
                }
                setActionError("")
                startTransition(async () => {
                  try {
                    const normalizedSource = sourceText.trim().toLocaleLowerCase().replace(/\s+/g, " ")
                    if (synapses.some((item) => item.source_text.trim().toLocaleLowerCase().replace(/\s+/g, " ") === normalizedSource)) {
                      setActionError("Ese chunk ya está en tu banco. Guarda una expresión diferente para sumar a la meta.")
                      return
                    }
                    await createSynapseItem(sourceText, targetText, "chunk")
                    setSourceText("")
                    setTargetText("")
                    setSynapses(await getSynapseItems())
                  } catch (error) {
                    console.error("No se pudo guardar el chunk:", error)
                    setActionError("No pudimos guardar el chunk. Comprueba la conexión y tu sesión.")
                  }
                })
              }} disabled={isPending || synapsingChunksToday >= 5} style={{ width: "100%", backgroundColor: synapsingChunksToday >= 5 ? "#064e3b" : "#10b981", color: synapsingChunksToday >= 5 ? "#a7f3d0" : "#000", fontWeight: "bold", padding: "10px", borderRadius: "8px", fontSize: "12px", cursor: isPending || synapsingChunksToday >= 5 ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>
                {isPending ? "Guardando…" : synapsingChunksToday >= 5 ? "Meta diaria alcanzada" : "Guardar en Banco de Chunks"}
              </button>
            </div>

            <button onClick={handleCompleteSynapsing} disabled={synapsingChunksToday < 5 || dailyHabits.raining || isPending} style={{ width: "100%", backgroundColor: synapsingChunksToday >= 5 && !dailyHabits.raining ? "#10b981" : "#022c22", color: synapsingChunksToday >= 5 && !dailyHabits.raining ? "#000" : "#047857", fontWeight: "bold", padding: "12px", borderRadius: "10px", fontSize: "12px", textTransform: "uppercase", cursor: synapsingChunksToday >= 5 && !dailyHabits.raining ? "pointer" : "not-allowed" }}>
              Completar Sesión de Synapsing y Marcar Hecho
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: SHADOWING */}
      {isShadowingOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 50 }}>
          <div ref={shadowingDialogRef} role="dialog" aria-modal="true" aria-label="Sala Shadowing" tabIndex={-1} style={{ backgroundColor: "#081208", border: "1px solid #065f46", borderRadius: "16px", width: "100%", maxWidth: "500px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #052e16", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#34d399" }}>🎙️ Shadowing (Musculación Oral)</h3>
              <button type="button" onClick={closeShadowingSession} aria-label="Cerrar Shadowing y detener la grabación" style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontSize: "11px", color: "#9ca3af" }}>Chunks grabados y escuchados hoy: <b style={{ color: "#34d399" }}>{practicedItemsCount} / 5</b> (Meta mínima)</p>
            
            {filteredSynapses.length > 0 ? (
              <>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", color: "#34d399" }}>
                Elige un chunk de tu banco
                <select value={selectedItemForPractice?.id ?? ""} disabled={isRecording || isRecordingStarting} onChange={(event) => { if (audioUrl) URL.revokeObjectURL(audioUrl); setSelectedItemForPracticeId(event.target.value); setAudioUrl(null); setRecordingItemId(null); setShadowingAudioReviewed(false); setShadowingError(""); resetAudioPlayback(shadowingPlaybackRef.current) }} style={{ width: "100%", backgroundColor: "#0b160b", border: "1px solid #052e16", borderRadius: "8px", padding: "10px", color: "#e5e7eb" }}>
                  {filteredSynapses.map((item) => <option key={item.id} value={item.id}>{item.source_text}</option>)}
                </select>
              </label>
              <div style={{ backgroundColor: "#0b160b", padding: "12px", borderRadius: "8px", border: "1px solid #052e16" }}>
                <p style={{ fontSize: "12px", fontWeight: "bold", color: "#34d399" }}>&ldquo;{selectedItemForPractice?.source_text}&rdquo;</p>
                <p style={{ fontSize: "11px", color: "#9ca3af" }}>({selectedItemForPractice?.target_text})</p>
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button onClick={() => speakText(selectedItemForPractice?.source_text)} style={{ flex: 1, backgroundColor: "#022c22", color: "#34d399", border: "1px solid #065f46", padding: "8px", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}>▶ Escuchar modelo TTS</button>
                  {!isRecording ? (
                    <button onClick={startRecording} disabled={isRecordingStarting} style={{ flex: 1, backgroundColor: "#7f1d1d", color: "#fca5a5", border: "1px solid #991b1b", padding: "8px", borderRadius: "6px", fontSize: "11px", cursor: isRecordingStarting ? "wait" : "pointer", opacity: isRecordingStarting ? 0.7 : 1 }}>{isRecordingStarting ? "Solicitando micrófono…" : "🔴 Grabar Voz"}</button>
                  ) : (
                    <button onClick={stopRecording} style={{ flex: 1, backgroundColor: "#dc2626", color: "#000", padding: "8px", borderRadius: "6px", fontSize: "11px", cursor: "pointer", fontWeight: "bold" }}>⏹️ Detener</button>
                  )}
                </div>
                {audioUrl && <audio src={audioUrl} controls onPlay={(event) => beginAudioPlayback(event, shadowingPlaybackRef.current)} onTimeUpdate={(event) => trackAudioPlayback(event, shadowingPlaybackRef.current)} onSeeked={(event) => { shadowingPlaybackRef.current.lastTime = event.currentTarget.currentTime }} onEnded={() => { if (hasHeardMostOfRecording(shadowingPlaybackRef.current) && recordingItemId) { markItemAsPracticed(recordingItemId); setShadowingAudioReviewed(true); setShadowingError("") } else { setShadowingAudioReviewed(false); setShadowingError("Para contar esta práctica, reproduce al menos el 90 % de la grabación sin adelantarla.") } }} style={{ width: "100%", height: "30px", marginTop: "8px" }} />}
                {shadowingAudioReviewed && <p role="status" style={{ color: "#34d399", fontSize: "11px" }}>Práctica registrada. Elige otro chunk para continuar.</p>}
                {shadowingError && <p role="alert" style={{ color: "#fca5a5", fontSize: "11px" }}>{shadowingError}</p>}
              </div>
              </>
            ) : (
              <p style={{ fontSize: "12px", color: "#f59e0b", textAlign: "center" }}>Agrega primero registros en Synapsing para practicar aquí.</p>
            )}

            <button onClick={handleCompleteShadowing} disabled={practicedItemsCount < 5 || isRecording} style={{ width: "100%", backgroundColor: practicedItemsCount >= 5 && !isRecording ? "#10b981" : "#022c22", color: practicedItemsCount >= 5 && !isRecording ? "#000" : "#047857", fontWeight: "bold", padding: "12px", borderRadius: "10px", fontSize: "12px", textTransform: "uppercase", cursor: practicedItemsCount >= 5 && !isRecording ? "pointer" : "not-allowed" }}>
              Completar Práctica (Meta: 5)
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: SPIKING */}
      {isSpikingOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 50 }}>
          <div ref={spikingDialogRef} role="dialog" aria-modal="true" aria-label="Sala Spiking" tabIndex={-1} style={{ backgroundColor: "#081208", border: "1px solid #065f46", borderRadius: "16px", width: "100%", maxWidth: "500px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #052e16", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#34d399" }}>⚡ Spiking (Simulador de Producción Oral)</h3>
              <button type="button" onClick={closeSpikingSession} aria-label="Cerrar Spiking y detener la grabación" style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontFamily: "monospace", textTransform: "uppercase", color: "#10b981" }}>1. Contexto de Combate ({userLevel}):</label>
                <select value={(MCER_CONTEXTS[userLevel] || MCER_CONTEXTS["B1"]).some((ctx) => ctx.label === spikingContext) ? spikingContext : (MCER_CONTEXTS[userLevel] || MCER_CONTEXTS["B1"])[0].label} disabled={isSpikingRecording || isSpikingStarting} onChange={(e) => { discardSpikingTake(); setSpikingContext(e.target.value); setCustomSpikingContext("") }} style={{ width: "100%", backgroundColor: "#0b160b", border: "1px solid #052e16", borderRadius: "8px", padding: "10px", fontSize: "11px", color: "#e5e7eb" }}>
                {(MCER_CONTEXTS[userLevel] || MCER_CONTEXTS["B1"]).map((ctx, idx) => (
                  <option key={idx} value={ctx.label}>{ctx.icon} {ctx.label}</option>
                ))}
              </select>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "#9ca3af", fontSize: "11px" }}>
                O escribe tu propio escenario
                <input value={customSpikingContext} disabled={isSpikingRecording || isSpikingStarting} onChange={(event) => { discardSpikingTake(); setCustomSpikingContext(event.target.value); if (event.target.value.trim()) setSpikingContext(event.target.value.trim()) }} placeholder="Ej.: pedir ayuda en una estación" style={{ width: "100%", backgroundColor: "#0b160b", border: "1px solid #052e16", borderRadius: "8px", padding: "10px", color: "#e5e7eb" }} />
              </label>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "11px", fontFamily: "monospace", textTransform: "uppercase", color: "#10b981" }}>2. Munición Verbal (Chunks):</label>
                <span style={{ fontSize: "10px", fontFamily: "monospace", padding: "2px 6px", borderRadius: "4px", backgroundColor: selectedSpikingChunks.length > 0 ? "#022c22" : "#7f1d1d", color: selectedSpikingChunks.length > 0 ? "#34d399" : "#fca5a5" }}>{selectedSpikingChunks.length} seleccionados</span>
              </div>
              <div style={{ backgroundColor: "#0b160b", border: "1px solid #052e16", borderRadius: "8px", padding: "8px", maxHeight: "110px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                {synapses.length > 0 ? (
                  synapses.map((item) => {
                    const isSelected = selectedSpikingChunks.includes(item.source_text)
                    return (
                      <button key={item.id} type="button" aria-pressed={isSelected} disabled={isSpikingRecording || isSpikingStarting} onClick={() => toggleSpikingChunkSelect(item.source_text)} className="w-full rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400" style={{ padding: "8px", borderRadius: "6px", border: `1px solid ${isSelected ? "#10b981" : "#052e16"}`, backgroundColor: isSelected ? "#022c22" : "#081208", fontSize: "11px", cursor: isSpikingRecording || isSpikingStarting ? "not-allowed" : "pointer", opacity: isSpikingRecording || isSpikingStarting ? 0.65 : 1, display: "flex", justifyContent: "space-between", alignItems: "center", color: isSelected ? "#34d399" : "#d1d5db" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>&ldquo;{item.source_text}&rdquo;</span>
                        <span style={{ fontSize: "10px", fontFamily: "monospace" }}>{isSelected ? "✓ Usar" : "+ Añadir"}</span>
                      </button>
                    )
                  })
                ) : (
                  <p style={{ fontSize: "11px", color: "#f59e0b", textAlign: "center", padding: "10px" }}>No hay chunks en tu banco. Regístralos primero en Synapsing.</p>
                )}
              </div>
            </div>

            <div style={{ backgroundColor: "#0b160b", padding: "16px", borderRadius: "12px", border: "1px solid #052e16", textAlign: "center", display: "flex", flexDirection: "column", gap: "12px" }}>
              {isSpikingRecording && (
                <span style={{ fontSize: "18px", fontWeight: "bold", color: "#ef4444", fontFamily: "monospace" }}>{formatTime(spikingSeconds)}</span>
              )}
              {!isSpikingRecording ? (
                <button onClick={startSpikingRecording} disabled={isSpikingStarting} style={{ width: "100%", backgroundColor: "#7f1d1d", color: "#fca5a5", border: "1px solid #991b1b", padding: "12px", borderRadius: "8px", fontWeight: "bold", fontSize: "12px", cursor: isSpikingStarting ? "wait" : "pointer", opacity: isSpikingStarting ? 0.7 : 1 }}>{isSpikingStarting ? "Solicitando micrófono…" : "🔴 Iniciar Sparring Hablado"}</button>
              ) : (
                <button onClick={stopSpikingRecording} style={{ width: "100%", backgroundColor: "#dc2626", color: "#000", padding: "12px", borderRadius: "8px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>⏹️ Detener Grabación</button>
              )}
              {spikingAudioUrl && <audio src={spikingAudioUrl} controls onPlay={(event) => beginAudioPlayback(event, spikingPlaybackRef.current)} onTimeUpdate={(event) => trackAudioPlayback(event, spikingPlaybackRef.current)} onSeeked={(event) => { spikingPlaybackRef.current.lastTime = event.currentTarget.currentTime }} onEnded={() => { if (hasHeardMostOfRecording(spikingPlaybackRef.current)) { setSpikingAudioReviewed(true); setSpikingError("") } else { setSpikingAudioReviewed(false); setSpikingError("Para completar el sparring, reproduce al menos el 90 % de tu grabación sin adelantarla.") } }} style={{ width: "100%", height: "30px" }} />}
              {spikingAudioUrl && <p style={{ color: spikingAudioReviewed ? "#34d399" : "#fbbf24", fontSize: "11px" }}>{spikingAudioReviewed ? "Grabación escuchada." : "Escucha tu grabación completa antes de marcar la estación como hecha."}</p>}
            </div>

            {spikingError && <p role="alert" style={{ color: "#fca5a5", fontSize: "12px" }}>{spikingError}</p>}
            <button onClick={handleCompleteSpiking} disabled={selectedSpikingChunks.length === 0 || !spikingAudioUrl || !spikingAudioReviewed || isSpikingRecording} style={{ width: "100%", backgroundColor: selectedSpikingChunks.length > 0 && spikingAudioUrl && spikingAudioReviewed && !isSpikingRecording ? "#10b981" : "#022c22", color: selectedSpikingChunks.length > 0 && spikingAudioUrl && spikingAudioReviewed && !isSpikingRecording ? "#000" : "#047857", fontWeight: "bold", padding: "12px", borderRadius: "10px", fontSize: "12px", textTransform: "uppercase", cursor: selectedSpikingChunks.length > 0 && spikingAudioUrl && spikingAudioReviewed && !isSpikingRecording ? "pointer" : "not-allowed" }}>
              Completar Sparring y Marcar Hecho
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: IMMERSING */}
      {isImmersingOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 50 }}>
          <div ref={immersingDialogRef} role="dialog" aria-modal="true" aria-label="Sala Immersing" tabIndex={-1} style={{ backgroundColor: "#081208", border: "1px solid #065f46", borderRadius: "16px", width: "100%", maxWidth: "500px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #052e16", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#34d399" }}>🥤 Immersing (Punto de Nutrición)</h3>
              <button onClick={() => setIsImmersingOpen(false)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontSize: "11px", color: "#9ca3af", lineHeight: "1.5" }}>
              Disfruta de 45 a 60 minutos de contenido en inglés que te agrade. El contador registra el tiempo que declares; no verifica qué contenido se reproduce.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[["Netflix", "https://www.netflix.com"], ["YouTube", "https://www.youtube.com"], ["Spotify", "https://open.spotify.com"], ["Radio Garden", "https://radio.garden"]].map(([label, href]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: "#0b160b", border: "1px solid #052e16", padding: "10px", borderRadius: "8px", color: "#d1d5db", textAlign: "center", textDecoration: "none", fontSize: "12px" }}>{label}</a>)}
            </div>
            <p role="timer" aria-live="off" style={{ textAlign: "center", color: immersingElapsedSeconds >= 45 * 60 ? "#34d399" : "#fbbf24", fontFamily: "monospace", fontSize: "24px", fontWeight: "bold" }}>{formatDuration(immersingElapsedSeconds)} / 45:00 mínimo</p>
            <p style={{ color: "#9ca3af", fontSize: "11px", textAlign: "center" }}>El contador mide el tiempo que mantienes la sesión activa; no puede verificar qué contenido reproduces.</p>
            {immersingStartedAt === null ? (
              <button onClick={beginImmersingTimer} style={{ width: "100%", backgroundColor: "#022c22", color: "#34d399", border: "1px solid #065f46", fontWeight: "bold", padding: "12px", borderRadius: "10px" }}>{immersingElapsedSeconds ? "Reanudar contador" : "Iniciar contador"}</button>
            ) : (
              <button onClick={pauseImmersingTimer} style={{ width: "100%", backgroundColor: "#7f1d1d", color: "#fecaca", fontWeight: "bold", padding: "12px", borderRadius: "10px" }}>Pausar contador</button>
            )}
            <button onClick={handleCompleteImmersing} disabled={immersingStartedAt !== null || immersingElapsedSeconds < 45 * 60} style={{ width: "100%", backgroundColor: immersingStartedAt === null && immersingElapsedSeconds >= 45 * 60 ? "#10b981" : "#022c22", color: immersingStartedAt === null && immersingElapsedSeconds >= 45 * 60 ? "#000" : "#047857", fontWeight: "bold", padding: "12px", borderRadius: "10px", fontSize: "12px", textTransform: "uppercase", cursor: immersingStartedAt === null && immersingElapsedSeconds >= 45 * 60 ? "pointer" : "not-allowed" }}>
              Completar Inmersión (45-60m) y Marcar Hecho
            </button>
          </div>
        </div>
      )}

    </main>
  )
}
