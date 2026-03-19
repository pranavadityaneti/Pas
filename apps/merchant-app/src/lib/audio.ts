import { Audio } from 'expo-av';

const SOUND_MAP: Record<string, any> = {
    'Amber': require('../../assets/sounds/amberalert.mp3'),
    'Bell': require('../../assets/sounds/bell.mp3'),
    'Alarm': require('../../assets/sounds/alarm.mp3'),
    'Siren': require('../../assets/sounds/siren.mp3'),
};

// Initialize audio mode for proper playback (even on silent)
Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    interruptionModeIOS: 1, // InterruptionModeIOS.DoNotMix
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    interruptionModeAndroid: 1, // InterruptionModeAndroid.DoNotMix
    playThroughEarpieceAndroid: false
});

let currentSound: Audio.Sound | null = null;

export const playSound = async (soundId: string) => {
    try {
        const soundFile = SOUND_MAP[soundId];
        if (!soundFile) return;

        // Cleanup before creating new
        if (currentSound) {
            try {
                await currentSound.stopAsync();
                await currentSound.unloadAsync();
            } catch (e) {
                // Ignore cleanup errors
            }
            currentSound = null;
        }

        const { sound } = await Audio.Sound.createAsync(
            soundFile,
            { shouldPlay: true }
        );
        currentSound = sound;

        // Unload when finished
        sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
                sound.unloadAsync().catch(() => {});
                if (currentSound === sound) {
                    currentSound = null;
                }
            }
        });
    } catch (error) {
        console.error('[Audio] Error playing sound:', error);
    }
};
