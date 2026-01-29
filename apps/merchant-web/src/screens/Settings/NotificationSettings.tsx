import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Bell, Volume2, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function NotificationSettings() {
    const navigate = useNavigate();
    // Settings State
    const [enabled, setEnabled] = useState(true);
    const [soundProfile, setSoundProfile] = useState('chime');
    const [volume, setVolume] = useState('high');

    // Load from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem('merchant_notification_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            setEnabled(parsed.enabled);
            setSoundProfile(parsed.soundProfile);
            setVolume(parsed.volume);
        }
    }, []);

    const saveSettings = (newSettings: any) => {
        localStorage.setItem('merchant_notification_settings', JSON.stringify(newSettings));
        toast.success("Settings saved");
    };

    const handleToggle = (checked: boolean) => {
        setEnabled(checked);
        saveSettings({ enabled: checked, soundProfile, volume });
    };

    const handleProfileChange = (val: string) => {
        setSoundProfile(val);
        saveSettings({ enabled, soundProfile: val, volume });
        // Preview Sound
        playSound(val);
    };

    const playSound = (profile: string) => {
        const audioUrl = getSoundUrl(profile);
        const audio = new Audio(audioUrl);
        audio.play().catch(e => console.log(e));
    }

    const getSoundUrl = (profile: string) => {
        // Using reliable external assets for demo. In prod, bundle these in /public
        switch (profile) {
            case 'alarm': return 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'; // Classic Ring
            case 'chime': return 'https://assets.mixkit.co/active_storage/sfx/2345/2345-preview.mp3'; // Bell
            case 'siren': return 'https://assets.mixkit.co/active_storage/sfx/999/999-preview.mp3'; // Urgent
            default: return 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-xl font-bold">Notification Settings</h1>
            </div>

            <div className="max-w-md mx-auto space-y-6">
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-indigo-600" />
                                    Order Alerts
                                </CardTitle>
                                <CardDescription>
                                    Ring when a new order arrives
                                </CardDescription>
                            </div>
                            <Switch checked={enabled} onCheckedChange={handleToggle} />
                        </div>
                    </CardHeader>
                    {enabled && (
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Sound Profile</Label>
                                <Select value={soundProfile} onValueChange={handleProfileChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select sound" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="chime">Gentle Chime</SelectItem>
                                        <SelectItem value="alarm">Classic Ring</SelectItem>
                                        <SelectItem value="siren">Loud Siren</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700 flex gap-2">
                                <Volume2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <p>
                                    <strong>Tip:</strong> Keep this tab open. Browsers may restrict audio if you haven't interacted with the page recently.
                                </p>
                            </div>
                        </CardContent>
                    )}
                </Card>
            </div>
        </div>
    );
}
