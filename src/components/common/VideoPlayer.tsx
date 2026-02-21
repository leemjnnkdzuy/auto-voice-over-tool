import {useRef, useState} from "react";
import {Play} from "lucide-react";
import {Button} from "@/components/ui/button";

interface VideoPlayerProps {
	src: string;
	className?: string;
	onTimeUpdate?: (time: number) => void;
	duration?: number;
}

export const VideoPlayer = ({
	src,
	className,
	onTimeUpdate,
}: VideoPlayerProps) => {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [isPlaying, setIsPlaying] = useState(false);

	const videoUrl = `http://127.0.0.1:9999/video?path=${encodeURIComponent(src)}`;

	const handlePlay = () => {
		setIsPlaying(true);
		videoRef.current?.play();
	};

	const handleTimeUpdate = () => {
		if (videoRef.current && onTimeUpdate) {
			onTimeUpdate(videoRef.current.currentTime);
		}
	};

	return (
		<div
			className={`relative w-full h-full flex items-center justify-center bg-black overflow-hidden ${className || ""}`}
		>
			{!isPlaying ?
				<div className='absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white gap-2 transition-all duration-300 z-10'>
					<Button
						onClick={handlePlay}
						variant='ghost'
						className='h-16 w-16 rounded-full bg-primary/30 hover:bg-primary/50 text-white hover:text-white backdrop-blur-md shadow-2xl transition-all hover:scale-110'
					>
						<Play className='w-8 h-8 ml-1 fill-current drop-shadow-lg' />
					</Button>
					<span className='text-sm font-medium opacity-90 tracking-wide'>
						Phát video
					</span>
				</div>
			:	null}
			<video
				ref={videoRef}
				src={videoUrl}
				controls
				autoPlay={isPlaying}
				onPlay={() => setIsPlaying(true)}
				onPause={() => setIsPlaying(false)}
				onTimeUpdate={handleTimeUpdate}
				onEnded={() => setIsPlaying(false)}
				className='w-full h-full object-contain bg-black'
				style={{maxHeight: "100%", maxWidth: "100%"}}
			/>
		</div>
	);
};
