import { Audio } from 'expo-av';

const SOUND_MAP: Record<string, any> = {
    'Amber': require('../../assets/sounds/amberalert.mp3'),
    'Bell': require('../../assets/sounds/bell.mp3'),
    'Alarm': require('../../assets/sounds/alarm.mp3'),
    'Siren': require('../../assets/sounds/siren.mp3'),
};

export const playSound = async (soundId: string) => {
    try {
        const soundFile = SOUND_MAP[soundId];
        if (!soundFile) {
            console.warn(`Sound ${soundId} not found in map.`);
            return;
        }

        const { sound } = await Audio.Sound.createAsync(soundFile);
        await sound.playAsync();

        // Unload sound from memory when done
        sound.setOnPlaybackStatusUpdate(async (status) => {
            if (status.isLoaded && status.didJustFinish) {
                await sound.unloadAsync();
            }
        });
    } catch (error) {
        console.error('Error playing sound:', error);
    }
};
