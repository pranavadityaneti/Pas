"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useAnimationFrame, useMotionValue } from "framer-motion";
import { Car, Store, ShoppingBag, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Types
type Obstacle = {
    id: number;
    lane: 'store' | 'pas';
    type: 'queue' | 'pickup'; // Queue = Bad (Store), Pickup = Good (Pas)
    y: number;
    speed: number;
};

export function CommuteRun() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [score, setScore] = useState(0);
    const [lane, setLane] = useState<'store' | 'pas'>('pas'); // Start in 'pas' lane
    const [obstacles, setObstacles] = useState<Obstacle[]>([]);
    const [status, setStatus] = useState<'running' | 'crashed' | 'idle'>('idle');

    // Game constraints
    const GAME_Height = 600;
    const SPAWN_RATE = 60; // Frames
    const BASE_SPEED = 5;
    const frameCount = useRef(0);

    // Game Loop
    useAnimationFrame((time, delta) => {
        if (status !== 'running') return;

        frameCount.current++;

        // Spawning Logic
        if (frameCount.current % SPAWN_RATE === 0) {
            spawnObstacle();
        }

        // Move Obstacles
        setObstacles(prev => {
            return prev
                .map(obs => ({ ...obs, y: obs.y + obs.speed }))
                .filter(obs => obs.y < GAME_Height + 100); // Cleanup off-screen
        });

        // Collision Detection (Simple Y-axis check)
        // Car is approx at Y: 500-550
        // Obstacle Hitbox approx 50x50
        const carY = GAME_Height - 100;

        obstacles.forEach(obs => {
            if (obs.y > carY - 40 && obs.y < carY + 40) {
                if (obs.lane === lane) {
                    handleCollision(obs);
                }
            }
        });
    });

    const spawnObstacle = () => {
        const id = Math.random();
        // Randomize which lane gets an item, but enforce the rules:
        // Store Lane (Left) = Mostly Obstacles (Queues)
        // Pas Lane (Right) = Mostly Pickups (Bags)

        // Sometimes mix it up to force movement?
        // Rule: 
        // Left Lane always spawns 'Queue' (Bad)
        // Right Lane always spawns 'Pickup' (Good)
        // To make it a "game", we need a reason to ever leave the Pas lane? 
        // Or maybe just show the contrast.

        // User requirement: "Lane 1 (Store): Blocked... Lane 2 (Pas): Open road..."
        // "User controls ... tap to switch lanes."
        // If Pas lane is always good, user never switches.
        // Let's add occasional "Road Works" in Pas lane to force a quick switch? 
        // OR simpler: Just spawn obstacles in Store lane and Bonuses in Pas lane to visualizing the difference.
        // But strictly following "Game" logic:
        // Let's spawn "Bad" things in Store lane. And "Good" things in Pas lane.
        // If user is in Store lane -> They hit obstacles and lose points/speed.
        // If user is in Pas lane -> They get points.
        // It's a "demonstration" game.

        const isBadSpawn = Math.random() > 0.5; // 50/50 chance to spawn SOMETHING

        if (isBadSpawn) {
            // Spawn BAD thing in STORE lane
            setObstacles(prev => [...prev, {
                id,
                lane: 'store',
                type: 'queue',
                y: -50,
                speed: BASE_SPEED
            }]);
        } else {
            // Spawn GOOD thing in PAS lane
            setObstacles(prev => [...prev, {
                id,
                lane: 'pas',
                type: 'pickup',
                y: -50,
                speed: BASE_SPEED
            }]);
        }
    };

    const handleCollision = (obs: Obstacle) => {
        // We only remove if handled to prevent double counting per frame
        // In a real game we'd mark 'hit'.
        // For this simple loop, we'll just check if it's "close enough" and not yet processed.

        // Actually, simpler: React state collision is tricky in useAnimationFrame.
        // Let's visual feedback only for now or simple score update.

        if (obs.type === 'queue') {
            // Bad!
            // Shake screen?
            setStatus('crashed');
            setTimeout(() => setStatus('running'), 500); // Brief stun
        } else if (obs.type === 'pickup') {
            setScore(s => s + 10);
            // Remove picked up item
            setObstacles(prev => prev.filter(o => o.id !== obs.id));
        }
    };

    const toggleLane = () => {
        setLane(prev => prev === 'store' ? 'pas' : 'store');
    };

    const startGame = () => {
        setScore(0);
        setObstacles([]);
        setStatus('running');
    };

    return (
        <section className="py-24 bg-gray-50 overflow-hidden">
            <div className="max-w-4xl mx-auto px-4 text-center mb-8">
                <h2 className="text-3xl font-bold mb-4">Experience the Pas Difference</h2>
                <p className="text-gray-500">Tap to switch lanes. Avoid the Store queues, stick to the Pas express lane!</p>
            </div>

            <div className="relative mx-auto w-full max-w-md h-[500px] border-4 border-gray-800 rounded-3xl overflow-hidden bg-gray-800 shadow-2xl">

                {/* Road Markings */}
                <div className="absolute inset-0 flex">
                    {/* Store Lane (Left) */}
                    <div className="w-1/2 h-full border-r-2 border-dashed border-gray-600 bg-gray-700/50 flex justify-center pt-4">
                        <span className="text-gray-500 font-mono text-xs uppercase tracking-widest opacity-50">Store Lane</span>
                    </div>
                    {/* Pas Lane (Right) */}
                    <div className="w-1/2 h-full bg-gray-800 flex justify-center pt-4">
                        <span className="text-emerald-500 font-mono text-xs uppercase tracking-widest opacity-50">Pas Lane</span>
                    </div>
                </div>

                {/* Moving Road Stripes Animation */}
                <motion.div
                    className="absolute top-0 bottom-0 left-1/2 w-0.5 border-l-2 border-dashed border-yellow-500"
                    animate={{ y: [0, 100] }}
                    transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }}
                />

                {/* Player Car */}
                <motion.div
                    className="absolute bottom-20 w-16 h-24 z-20"
                    animate={{
                        x: lane === 'store' ? '25%' : '75%', // Center of Left lane vs Right lane
                        left: '-2rem' // Access offset to center component
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    {/* Car SVG */}
                    <div className={cn(
                        "w-full h-full rounded-2xl shadow-lg flex items-center justify-center transition-colors",
                        lane === 'pas' ? "bg-emerald-500 shadow-emerald-500/20" : "bg-red-400 shadow-red-500/20"
                    )}>
                        <Car className="text-white w-8 h-8" />
                    </div>
                    {/* Exhaust Fumes */}
                    {status === 'running' && (
                        <motion.div
                            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-gray-400/30 rounded-full blur-sm"
                            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                            transition={{ repeat: Infinity, duration: 0.2 }}
                        />
                    )}
                </motion.div>

                {/* Obstacles */}
                {obstacles.map(obs => (
                    <div
                        key={obs.id}
                        className="absolute w-12 h-12 -ml-6 flex items-center justify-center"
                        style={{
                            top: obs.y,
                            left: obs.lane === 'store' ? '25%' : '75%'
                        }}
                    >
                        {obs.type === 'queue' ? (
                            <div className="w-12 h-12 bg-red-500/20 rounded-lg border-2 border-red-500 flex items-center justify-center">
                                <Store className="text-red-500 w-6 h-6" />
                                <div className="absolute -top-6 text-xs bg-red-600 text-white px-1 rounded">QUEUE</div>
                            </div>
                        ) : (
                            <div className="w-10 h-10 bg-emerald-500/20 rounded-full border-2 border-emerald-400 flex items-center justify-center">
                                <ShoppingBag className="text-emerald-400 w-5 h-5" />
                                <div className="absolute -top-6 text-xs bg-emerald-600 text-white px-1 rounded">+TIME</div>
                            </div>
                        )}
                    </div>
                ))}

                {/* UI Overlay */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center text-white z-30 font-mono text-sm">
                    <div className="bg-black/50 px-3 py-1 rounded-full border border-gray-700">
                        TIME SAVED: {score}m
                    </div>
                    {status === 'crashed' && (
                        <div className="text-red-500 font-bold animate-pulse">
                            STUCK IN QUEUE!
                        </div>
                    )}
                </div>

                {/* Start / Game Over Screen */}
                {status === 'idle' && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-40 p-6 text-center">
                        <Car className="w-16 h-16 text-emerald-500 mb-4" />
                        <h3 className="text-2xl font-bold mb-2">Beat the Queue</h3>
                        <p className="text-gray-400 mb-6 text-sm">Tap the screen to switch lanes. Stay in the green lane to save time!</p>
                        <button
                            onClick={(e) => { e.stopPropagation(); startGame(); }}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-full font-bold transition-all hover:scale-105"
                        >
                            Start Driving
                        </button>
                    </div>
                )}

                {/* Tap Area */}
                <div
                    className="absolute inset-0 z-10 cursor-pointer"
                    onClick={toggleLane}
                />

            </div>
        </section>
    );
}
