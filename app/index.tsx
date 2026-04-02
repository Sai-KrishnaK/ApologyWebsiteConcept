import { Audio } from "expo-av";
import * as Location from "expo-location";
import { Asset } from "expo-asset";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const TARGET_COORDS = { latitude: 28.6139, longitude: 77.209 };
const ALLOWED_RADIUS_METERS = 1000;

const MEMORY_IMAGES = [
  Asset.fromModule(require("../assets/memory1.jpg")).uri,
  Asset.fromModule(require("../assets/memory2.jpg")).uri,
  Asset.fromModule(require("../assets/memory3.jpg")).uri,
];

const FINAL_IMAGES = [
  Asset.fromModule(require("../assets/final1.jpg")).uri,
  Asset.fromModule(require("../assets/final2.jpg")).uri,
];

// Puzzle image (Put us back together)
const COUPLE_IMAGE = Asset.fromModule(require("../assets/memory2.jpg")).uri;
const MUSIC_URL = Asset.fromModule(require("../assets/music.wav")).uri;

const BALLOON_WORDS = ["Sorry", "Love You", "Miss You", "My Fault"];
const APOLOGY_LINES = [
  "I replayed everything in my head.",
  "I know my words and actions hurt you deeply.",
  "You deserved patience, care, and softness from me.",
  "I am truly sorry for breaking your trust.",
  "I cannot undo the pain, but I can grow from it.",
  "If you let me, I want to love you better every day.",
];

type Step =
  | "location"
  | "intro"
  | "memories"
  | "puzzle"
  | "build"
  | "balloons"
  | "sorry"
  | "forgive"
  | "birthday"
  | "final";

type Balloon = { id: number; left: number; duration: number; word: string };
type PopEffect = { id: number; x: number; y: number; text: string };

const TIMING = {
  memoryCaptionDelay: 1400,
  memoryScreenDuration: 5600,
  puzzleSolvedRevealDelay: 900,
  puzzleToBuildDelay: 3200,
  buildLine1Delay: 1200,
  buildLine2Delay: 4300,
  buildToBalloonsDelay: 7600,
  balloonSpawnMs: 900,
  balloonContinueDelay: 1200,
  apologyStartDelay: 1200,
  apologyLineStepMs: 1400,
  birthdayLine1Delay: 1300,
  birthdayLine2Delay: 3400,
  birthdayLine3Delay: 5200,
};

const BALLOON_TARGET = 12;

const AnimatedText = Animated.createAnimatedComponent(Text);

function haversineMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const c1 = toRad(a.latitude);
  const c2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(c1) * Math.cos(c2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * r * Math.asin(Math.sqrt(h));
}

function FadeIn({
  delay = 0,
  duration = 450,
  fromY = 8,
  fromScale = 1,
  style,
  children,
}: {
  delay?: number;
  duration?: number;
  fromY?: number;
  fromScale?: number;
  style?: any;
  children: React.ReactNode;
}) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(fromY);
  const scale = useSharedValue(fromScale);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.quad) }));
    ty.value = withDelay(delay, withTiming(0, { duration, easing: Easing.out(Easing.quad) }));
    scale.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.quad) }));
  }, [delay, duration, opacity, ty, scale]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }, { scale: scale.value }],
  }));

  return <Animated.View style={[aStyle, style]}>{children}</Animated.View>;
}

function Particle({
  left,
  size,
  delay,
  duration,
  symbol,
}: {
  left: string;
  size: number;
  delay: number;
  duration: number;
  symbol: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1, false)
    );
    return () => cancelAnimation(progress);
  }, [delay, duration, progress]);

  const aStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.5, 1], [0.1, 0.55, 0.1]);
    const translateY = interpolate(progress.value, [0, 1], [20, -40]);
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <AnimatedText
      style={[
        styles.particle,
        aStyle,
        { left, fontSize: size + 6, color: "rgba(255,150,210,0.45)" },
      ]}
    >
      {symbol}
    </AnimatedText>
  );
}

function ParticleBackground() {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        size: 4 + Math.random() * 8,
        delay: Math.random() * 1800,
        duration: 3500 + Math.random() * 2200,
        symbol: Math.random() > 0.65 ? "❤" : "•",
      })),
    []
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p) => (
        <Particle
          key={p.id}
          left={p.left}
          size={p.size}
          delay={p.delay}
          duration={p.duration}
          symbol={p.symbol}
        />
      ))}
    </View>
  );
}

function AnimatedButton({
  label,
  onPress,
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  style?: object;
  textStyle?: object;
}) {
  const pressed = useSharedValue(0);
  const shake = useSharedValue(0);

  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withTiming(pressed.value ? 0.95 : 1, { duration: 140 }) },
      { translateX: shake.value },
    ],
  }));

  return (
    <Pressable
      onPressIn={() => {
        pressed.value = 1;
        shake.value = withSequence(
          withTiming(-1.5, { duration: 40 }),
          withTiming(1.5, { duration: 40 }),
          withTiming(-1, { duration: 40 }),
          withTiming(1, { duration: 40 }),
          withTiming(0, { duration: 40 })
        );
      }}
      onPressOut={() => {
        pressed.value = 0;
      }}
      onPress={() => {
        runOnJS(onPress)();
      }}
    >
      <Animated.View style={[styles.button, style, aStyle]}>
        <Text style={[styles.buttonText, textStyle]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function RomanticExperience() {
  const [step, setStep] = useState<Step>("location");
  const [transitioning, setTransitioning] = useState(false);
  const [geoMessage, setGeoMessage] = useState("Surprise unlocked ❤️");
  const [unlocked, setUnlocked] = useState(true);
  const [memoryIndex, setMemoryIndex] = useState(0);
  const [showMemoryCaption, setShowMemoryCaption] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [typedBuild, setTypedBuild] = useState<string[]>([]);
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [poppedCount, setPoppedCount] = useState(0);
  const [apologyVisibleLines, setApologyVisibleLines] = useState(0);
  const [noScale, setNoScale] = useState(1);
  const [noPos, setNoPos] = useState({ x: 0, y: 0, shake: false });
  const [birthdayReveal, setBirthdayReveal] = useState(0);
  const [finalReveal, setFinalReveal] = useState(false);
  const [puzzleTiles, setPuzzleTiles] = useState<number[]>([]);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [puzzleDone, setPuzzleDone] = useState(false);
  const [popEffects, setPopEffects] = useState<PopEffect[]>([]);
  const [canContinueBalloons, setCanContinueBalloons] = useState(false);
  const balloonIdRef = useRef(1);
  const { width } = useWindowDimensions();

  useEffect(() => {
    Asset.loadAsync([...MEMORY_IMAGES, ...FINAL_IMAGES, COUPLE_IMAGE]).catch(() => undefined);
  }, []);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => undefined);
      }
    };
  }, [sound]);

  useEffect(() => {
    const tiles = Array.from({ length: 9 }).map((_, i) => i);
    for (let i = tiles.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    setPuzzleTiles(tiles);
  }, []);

  const fadeTo = useCallback((next: Step) => {
    setTransitioning(true);
    setTimeout(() => {
      setStep(next);
      setTransitioning(false);
    }, 650);
  }, []);

  const requestLocation = useCallback(async () => {
    // Web-demo mode: bypass geofence and accept any location.
    // (If you want the gate back later, revert to the permission + distance check.)
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch {
      // ignore
    }
    setUnlocked(true);
    setGeoMessage("Surprise unlocked ❤️");
  }, []);

  const startMusic = useCallback(async () => {
    try {
      const created = await Audio.Sound.createAsync(
        { uri: MUSIC_URL },
        { shouldPlay: true, isLooping: true, volume: 0.35 }
      );
      setSound(created.sound);
    } catch {
      // Web autoplay/network can fail; keep flow alive.
    }
  }, []);

  useEffect(() => {
    if (step !== "memories") return;
    setShowMemoryCaption(false);
    const captionDelay = setTimeout(() => setShowMemoryCaption(true), TIMING.memoryCaptionDelay);
    const nextDelay = setTimeout(() => {
      setMemoryIndex((prev) => {
        if (prev >= MEMORY_IMAGES.length - 1) {
          fadeTo("puzzle");
          return prev;
        }
        return prev + 1;
      });
      setShowMemoryCaption(false);
    }, TIMING.memoryScreenDuration);
    return () => {
      clearTimeout(captionDelay);
      clearTimeout(nextDelay);
    };
  }, [step, memoryIndex, fadeTo]);

  const swapTiles = (idx: number) => {
    if (puzzleDone) return;
    if (selectedTile === null) {
      setSelectedTile(idx);
      return;
    }
    const next = [...puzzleTiles];
    [next[selectedTile], next[idx]] = [next[idx], next[selectedTile]];
    setPuzzleTiles(next);
    setSelectedTile(null);
    const solved = next.every((tile, i) => tile === i);
    if (solved) {
      setTimeout(() => setPuzzleDone(true), TIMING.puzzleSolvedRevealDelay);
      setTimeout(() => fadeTo("build"), TIMING.puzzleToBuildDelay);
    }
  };

  useEffect(() => {
    if (step !== "build") return;
    setTypedBuild([]);
    const t1 = setTimeout(() => setTypedBuild(["I know I messed up"]), TIMING.buildLine1Delay);
    const t2 = setTimeout(
      () => setTypedBuild(["I know I messed up", "And I hurt you"]),
      TIMING.buildLine2Delay
    );
    const t3 = setTimeout(() => fadeTo("balloons"), TIMING.buildToBalloonsDelay);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [step, fadeTo]);

  useEffect(() => {
    if (step !== "balloons" || poppedCount >= BALLOON_TARGET) return;
    const spawner = setInterval(() => {
      setBalloons((prev) => [
        ...prev,
        {
          id: balloonIdRef.current++,
          left: 8 + Math.random() * 80,
          duration: 3600 + Math.random() * 1800,
          word: BALLOON_WORDS[Math.floor(Math.random() * BALLOON_WORDS.length)],
        },
      ].slice(-14));
    }, TIMING.balloonSpawnMs);
    return () => clearInterval(spawner);
  }, [step, poppedCount]);

  useEffect(() => {
    if (step !== "sorry") return;
    setApologyVisibleLines(0);
    APOLOGY_LINES.forEach((_, i) => {
      setTimeout(
        () => setApologyVisibleLines(i + 1),
        TIMING.apologyStartDelay + i * TIMING.apologyLineStepMs
      );
    });
  }, [step]);

  useEffect(() => {
    if (step !== "birthday") return;
    setBirthdayReveal(0);
    const a = setTimeout(() => setBirthdayReveal(1), TIMING.birthdayLine1Delay);
    const b = setTimeout(() => setBirthdayReveal(2), TIMING.birthdayLine2Delay);
    const c = setTimeout(() => setBirthdayReveal(3), TIMING.birthdayLine3Delay);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
      clearTimeout(c);
    };
  }, [step]);

  useEffect(() => {
    if (step !== "final") return;
    const t = setTimeout(() => setFinalReveal(true), 800);
    return () => clearTimeout(t);
  }, [step]);

  const popBalloon = (id: number) => {
    const hit = balloons.find((b) => b.id === id);
    setBalloons((prev) => prev.filter((b) => b.id !== id));
    setPoppedCount((v) => v + 1);
    if (hit) {
      const effectId = Date.now() + id;
      setPopEffects((prev) => [
        ...prev,
        { id: effectId, x: hit.left, y: 70 + Math.random() * 20, text: hit.word },
      ]);
      setTimeout(() => {
        setPopEffects((prev) => prev.filter((e) => e.id !== effectId));
      }, 950);
    }
  };

  useEffect(() => {
    if (step !== "balloons" || poppedCount < BALLOON_TARGET) return;
    setCanContinueBalloons(false);
    const t = setTimeout(() => setCanContinueBalloons(true), TIMING.balloonContinueDelay);
    return () => clearTimeout(t);
  }, [step, poppedCount]);

  const captions = [
    "Every moment with you is a memory I keep close.",
    "Even silence with you feels like home.",
    "Your smile still melts every fear in me.",
  ];

  const overlayOpacity = useSharedValue(0);
  useEffect(() => {
    overlayOpacity.value = withTiming(transitioning ? 1 : 0, { duration: 650 });
  }, [transitioning, overlayOpacity]);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  const finalGlow = useSharedValue(0);
  useEffect(() => {
    if (step !== "final") return;
    finalGlow.value = 0;
    finalGlow.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(finalGlow);
  }, [step, finalGlow]);
  const finalGlowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(finalGlow.value, [0, 1], [0.3, 0.6]);
    const scale = interpolate(finalGlow.value, [0, 1], [0.95, 1.02]);
    return { opacity, transform: [{ scale }] };
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ParticleBackground />
        <Animated.View
          pointerEvents={transitioning ? "auto" : "none"}
          style={[styles.fadeOverlay, overlayStyle]}
        />

        {step === "location" && (
          <View style={styles.center}>
            <Text style={styles.title}>A tiny surprise waits for you</Text>
            <Text style={styles.message}>{geoMessage}</Text>
            <AnimatedButton label="Continue" onPress={() => setStep("intro")} />
            <FadeIn delay={350}>
              <AnimatedButton
                label="(Optional) Allow Location"
                onPress={requestLocation}
                style={styles.secondaryBtn}
                textStyle={{ fontSize: 14 }}
              />
            </FadeIn>
          </View>
        )}

        {step === "intro" && (
          <View style={styles.center}>
            <Text style={styles.title}>Hey... this is something just for you</Text>
            <AnimatedButton
              label="Start the Surprise"
              onPress={async () => {
                await startMusic();
                setStep("memories");
              }}
            />
          </View>
        )}

        {step === "memories" && (
          <View style={styles.center}>
            <FadeIn key={`mem-${memoryIndex}`} duration={900} fromScale={1.05} fromY={0}>
              <Image source={{ uri: MEMORY_IMAGES[memoryIndex] }} style={styles.memoryImage} />
            </FadeIn>
            {showMemoryCaption && (
              <FadeIn key={`cap-${memoryIndex}`} duration={450} fromY={8}>
                <Text style={styles.caption}>{captions[memoryIndex]}</Text>
              </FadeIn>
            )}
          </View>
        )}

        {step === "puzzle" && (
          <View style={styles.center}>
            <Text style={styles.title}>Put us back together</Text>
            <View style={styles.grid}>
              {puzzleTiles.map((tile, idx) => {
                const row = Math.floor(tile / 3);
                const col = tile % 3;
                return (
                  <Pressable key={`${tile}-${idx}`} onPress={() => swapTiles(idx)} style={styles.tileWrap}>
                    <Animated.View
                      style={[
                        styles.tile,
                        selectedTile === idx ? { transform: [{ scale: 0.95 }, { rotateZ: "-1deg" }] } : null,
                      ]}
                    >
                      <Image
                        source={{ uri: COUPLE_IMAGE }}
                        style={[
                          styles.tileImage,
                          {
                            width: 300,
                            height: 300,
                            marginLeft: -col * 100,
                            marginTop: -row * 100,
                          },
                        ]}
                      />
                    </Animated.View>
                  </Pressable>
                );
              })}
            </View>
            {puzzleDone && (
              <FadeIn delay={900}>
                <Text style={styles.message}>You complete my world ❤️</Text>
              </FadeIn>
            )}
          </View>
        )}

        {step === "build" && (
          <View style={styles.center}>
            {typedBuild.map((line) => (
              <FadeIn key={line}>
                <Text style={styles.buildText}>{line}</Text>
              </FadeIn>
            ))}
          </View>
        )}

        {step === "balloons" && (
          <View style={styles.balloonArea}>
            <Text style={styles.title}>Pop the words I should have said</Text>
            <Text style={styles.subtle}>Popped: {poppedCount}/{BALLOON_TARGET}</Text>
            {balloons.map((b) => (
              <Pressable key={b.id} onPress={() => popBalloon(b.id)} style={[styles.balloonWrap, { left: `${b.left}%` }]}>
                <FadeIn duration={260} fromScale={0.95} fromY={0} style={styles.balloon}>
                  <Text style={styles.balloonText}>{b.word}</Text>
                </FadeIn>
              </Pressable>
            ))}
            {popEffects.map((e) => (
              <FadeIn
                key={e.id}
                duration={350}
                fromScale={0.8}
                fromY={0}
                style={[styles.popEffectWrap, { left: `${e.x}%`, top: `${e.y}%` }]}
              >
                <Text style={styles.popHeart}>❤ ❤ ❤</Text>
                <Text style={styles.popText}>{e.text}</Text>
              </FadeIn>
            ))}
            {poppedCount >= BALLOON_TARGET && canContinueBalloons && (
              <FadeIn delay={900}>
                <AnimatedButton label="Continue" onPress={() => fadeTo("sorry")} />
              </FadeIn>
            )}
          </View>
        )}

        {step === "sorry" && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>A note from my heart</Text>
            {APOLOGY_LINES.slice(0, apologyVisibleLines).map((line) => (
              <FadeIn key={line}>
                <Text style={styles.apologyLine}>{line}</Text>
              </FadeIn>
            ))}
            {apologyVisibleLines >= APOLOGY_LINES.length && (
              <FadeIn delay={500}>
                <AnimatedButton label="Next" onPress={() => setStep("forgive")} />
              </FadeIn>
            )}
          </ScrollView>
        )}

        {step === "forgive" && (
          <View style={styles.center}>
            <Text style={styles.title}>Do you forgive me? 🥺</Text>
            <AnimatedButton label="YES ❤️" onPress={() => fadeTo("birthday")} />
            <Pressable
              onPress={() => {
                setNoScale((s) => Math.max(0.35, s - 0.08));
                setNoPos({
                  x: (Math.random() - 0.5) * Math.min(160, width * 0.45),
                  y: (Math.random() - 0.5) * 120,
                  shake: true,
                });
                setTimeout(() => setNoPos((v) => ({ ...v, shake: false })), 220);
              }}
            >
              <Animated.View
                style={[
                  styles.button,
                  styles.noButton,
                  {
                    transform: [
                      { scale: noScale },
                      { translateX: noPos.x },
                      { translateY: noPos.y },
                    ],
                  },
                ]}
              >
                <Text style={styles.buttonText}>NO 🙃</Text>
              </Animated.View>
            </Pressable>
          </View>
        )}

        {step === "birthday" && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>For your day, my love</Text>
            <Image source={{ uri: FINAL_IMAGES[0] }} style={styles.memoryImage} />
            {birthdayReveal >= 1 && (
              <FadeIn>
                <Text style={styles.apologyLine}>You deserve laughter, peace, and all the gentle love in the world.</Text>
              </FadeIn>
            )}
            {birthdayReveal >= 2 && (
              <>
                <Image source={{ uri: FINAL_IMAGES[1] }} style={styles.memoryImage} />
                <FadeIn>
                  <Text style={styles.apologyLine}>Thank you for being the brightest part of my life.</Text>
                </FadeIn>
              </>
            )}
            {birthdayReveal >= 3 && (
              <>
                <Text style={styles.bigHighlight}>Happy Birthday ❤️</Text>
                <AnimatedButton label="One Last Thing" onPress={() => fadeTo("final")} />
              </>
            )}
          </ScrollView>
        )}

        {step === "final" && (
          <View style={styles.center}>
            <Animated.View style={[styles.finalGlow, finalGlowStyle]} />
            {finalReveal && <Text style={styles.finalText}>I love you</Text>}
            <AnimatedButton
              label="Replay"
              onPress={() => {
                setMemoryIndex(0);
                setShowMemoryCaption(false);
                setPoppedCount(0);
                setBalloons([]);
                setCanContinueBalloons(false);
                setPopEffects([]);
                setPuzzleDone(false);
                setSelectedTile(null);
                setStep("intro");
              }}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#08020f" },
  container: {
    flex: 1,
    backgroundColor: "#08020f",
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  fadeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 8,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    zIndex: 10,
  },
  scroll: {
    paddingVertical: 44,
    gap: 14,
    alignItems: "center",
    zIndex: 10,
  },
  title: {
    color: "#ffd4f0",
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    textAlign: "center",
    textShadowColor: "rgba(255,111,196,0.4)",
    textShadowRadius: 14,
  },
  message: {
    color: "#f3d4ff",
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 360,
  },
  subtle: {
    color: "#e2bfe7",
    fontSize: 14,
  },
  button: {
    backgroundColor: "#b0338f",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,199,239,0.45)",
    shadowColor: "#ff7ec7",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
  },
  secondaryBtn: { marginTop: 8, backgroundColor: "#6f2ca1" },
  noButton: { backgroundColor: "#3e2a5c" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  memoryImage: {
    width: 320,
    height: 420,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,180,220,0.45)",
  },
  caption: {
    marginTop: 10,
    color: "#ffd8ef",
    fontSize: 17,
    textAlign: "center",
    maxWidth: 340,
  },
  grid: { width: 306, flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 8 },
  tileWrap: { width: 100, height: 100 },
  tile: {
    width: 100,
    height: 100,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,189,231,0.5)",
    borderRadius: 8,
  },
  tileImage: { resizeMode: "cover" },
  buildText: {
    color: "#ffd5ee",
    fontSize: 30,
    lineHeight: 40,
    textAlign: "center",
    marginVertical: 4,
  },
  balloonArea: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 40,
    zIndex: 10,
  },
  balloonWrap: {
    position: "absolute",
    bottom: 0,
  },
  balloon: {
    width: 88,
    height: 112,
    borderRadius: 44,
    backgroundColor: "#ce4faa",
    justifyContent: "center",
    alignItems: "center",
    borderColor: "rgba(255,211,235,0.65)",
    borderWidth: 1,
  },
  balloonText: { color: "#fff", fontWeight: "700", textAlign: "center", fontSize: 13 },
  popEffectWrap: {
    position: "absolute",
    alignItems: "center",
  },
  popHeart: {
    color: "#ffb5de",
    fontSize: 16,
    fontWeight: "700",
    textShadowColor: "rgba(255,130,197,0.7)",
    textShadowRadius: 10,
  },
  popText: {
    color: "#ffe2f4",
    fontSize: 13,
    marginTop: 2,
  },
  apologyLine: {
    color: "#f5d8ff",
    fontSize: 17,
    lineHeight: 26,
    textAlign: "center",
    maxWidth: 360,
  },
  particle: {
    position: "absolute",
    bottom: 0,
  },
  bigHighlight: {
    fontSize: 38,
    fontWeight: "800",
    color: "#ffb8dc",
    textAlign: "center",
    marginTop: 12,
    textShadowColor: "rgba(255,130,197,0.55)",
    textShadowRadius: 14,
  },
  finalGlow: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(194,76,145,0.35)",
    position: "absolute",
  },
  finalText: {
    color: "#ffe5f4",
    fontSize: 44,
    fontWeight: "800",
    marginBottom: 18,
    textShadowColor: "rgba(255,119,196,0.55)",
    textShadowRadius: 16,
  },
});
