import { useState } from 'react';
import { 
  GripVertical, 
  Trash2, 
  Edit2, 
  ImagePlus, 
  ExternalLink,
  Eye
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { toast } from 'sonner';

const initialBanners = [
  { id: 1, title: 'Monsoon Sale', link: 'Category: Grocery', image: 'https://images.unsplash.com/photo-1652266301722-ebaf6283024d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', status: 'active' },
  { id: 2, title: 'Fresh Fruits Promo', link: 'Collection: Summer Fruits', image: 'https://images.unsplash.com/photo-1560096142-792fc2baab4a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', status: 'active' },
  { id: 3, title: 'Weekend Special', link: 'Page: Deals', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80', status: 'scheduled' },
];

export function BannerManager() {
  const [banners, setBanners] = useState(initialBanners);

  const handleDelete = (id: number) => {
    setBanners(banners.filter(b => b.id !== id));
    toast.success('Banner deleted');
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === banners.length - 1) return;

    const newBanners = [...banners];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newBanners[index], newBanners[swapIndex]] = [newBanners[swapIndex], newBanners[index]];
    setBanners(newBanners);
  };

  return (
    <div className="h-full flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Home Screen Banners</h2>
          <p className="text-sm text-gray-500">Manage the carousel banners shown on the app home screen.</p>
        </div>
      </div>

      <div className="space-y-4">
        {banners.map((banner, index) => (
          <Card key={banner.id} className="p-4 flex items-center gap-4 group hover:border-blue-200 transition-colors bg-white">
            {/* Drag Handle (Visual Only for now) */}
            <div className="flex flex-col items-center gap-1 text-gray-400">
               <button onClick={() => handleMove(index, 'up')} className="hover:text-gray-600 disabled:opacity-20" disabled={index === 0}>▲</button>
               <GripVertical className="w-5 h-5 cursor-grab active:cursor-grabbing" />
               <button onClick={() => handleMove(index, 'down')} className="hover:text-gray-600 disabled:opacity-20" disabled={index === banners.length - 1}>▼</button>
            </div>

            {/* Thumbnail */}
            <div className="w-48 aspect-video rounded-lg overflow-hidden border border-gray-100 bg-gray-50 shrink-0 relative">
              <ImageWithFallback 
                src={banner.image} 
                alt={banner.title} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Button variant="secondary" size="sm" className="h-7 text-xs bg-white/90 hover:bg-white">
                  <Eye className="w-3 h-3 mr-1" /> Preview
                </Button>
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 truncate">{banner.title}</h3>
                {banner.status === 'scheduled' && (
                  <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 text-[10px] h-5 px-1.5">Scheduled</Badge>
                )}
                {banner.status === 'active' && (
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[10px] h-5 px-1.5">Live</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="truncate">{banner.link}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-blue-600">
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => handleDelete(banner.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}

        {/* Upload Drop Zone */}
        <button 
          className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 transition-all gap-3"
          onClick={() => toast.info('File picker would open here')}
        >
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <ImagePlus className="w-5 h-5" />
          </div>
          <div className="text-center">
            <span className="font-semibold">Click to upload</span> or drag and drop
            <p className="text-xs text-gray-400 mt-1">SVG, PNG, JPG (16:9 aspect ratio recommended)</p>
          </div>
        </button>
      </div>
    </div>
  );
}
