import { Spinner } from '@/components/ui/spinner';
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
	
	Film,
	CheckCircle2,
	FileText,
	AlertCircle,
	Clapperboard,
	FolderOpen,
	RefreshCw} from "lucide-react";
import { VideoPlayer } from "./VideoPlayer";
import { useProcessContext } from "@/stores/ProcessStore";

interface VideoProgress {
	status:
	| "preparing"
	| "processing"
	| "concatenating"
	| "rerendering"
	| "done"
	| "error";
	progress: number;
	detail: string;
	current?: number;
	total?: number;
}

export const CreateFinalVideoPhase = ({ onComplete }: { onComplete?: () => void }) => {
	const { id } = useParams();
	const [phase, setPhase] = useState<"loading" | "no-data" | "ready">(
		"loading",
	);
	const [projectPath, setProjectPath] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState<VideoProgress | null>(null);
	const [outputPath, setOutputPath] = useState<string | null>(null);
	const [hasExistingFinal, setHasExistingFinal] = useState(false);
	const [missingItem, setMissingItem] = useState("");

	const { setIsProcessing: setGlobalProcessing } = useProcessContext();

	useEffect(() => {
		setGlobalProcessing(isProcessing);
	}, [isProcessing, setGlobalProcessing]);

	useEffect(() => {
		const init = async () => {
			const projects = await window.api.getProjects();
			const project = projects.find((p: any) => p.id === id);
			if (!project) {
				setPhase("loading");
				return;
			}
			setProjectPath(project.path);

			const checkResult = await window.api.checkFinalVideoReady(
				project.path,
			);
			if (!checkResult.ready) {
				setMissingItem(checkResult.missing || "");
				setPhase("no-data");
				return;
			}

			if (checkResult.existingFinal) {
				setOutputPath(checkResult.existingFinal);
				setHasExistingFinal(true);
			}

			setPhase("ready");
		};

		init();
	}, [id]);

	useEffect(() => {
		window.api.onFinalVideoProgress((progressData: VideoProgress) => {
			setProgress(progressData);

			if (progressData.status === "done") {
				setIsProcessing(false);
				setHasExistingFinal(true);
				window.api
					.checkFinalVideoReady(projectPath)
					.then((r: { existingFinal?: string | null }) => {
						if (r.existingFinal) {
							setOutputPath(r.existingFinal);
						}
					});
			} else if (progressData.status === "error") {
				setIsProcessing(false);
			}
		});

		return () => {
			window.api.removeFinalVideoListeners();
		};
	}, [projectPath, onComplete]);


	const handleStartCreate = () => {
		if (!projectPath) return;
		setIsProcessing(true);
		setProgress(null);
		setOutputPath(null);
		window.api.createFinalVideo(projectPath);
	};

	const handleOpenFolder = () => {
		if (outputPath) {
			window.api.openInExplorer(outputPath);
		}
	};

	if (phase === "loading") {
		return (
			<div className='flex items-center justify-center h-full'>
				<Spinner className='w-8 h-8 animate-spin text-primary' />
			</div>
		);
	}

	if (phase === "no-data") {
		return (
			<div className='flex flex-col items-center justify-center h-full p-4'>
				<div className='text-center space-y-4 animate-in fade-in duration-300'>
					<FileText className='w-16 h-16 text-muted-foreground/30 mx-auto' />
					<h2 className='text-xl font-bold'>Chưa đủ dữ liệu</h2>
					<p className='text-sm text-muted-foreground'>
						{missingItem ||
							"Cần có video gốc, phụ đề gốc và audio đã tạo để ghép video final."}
					</p>
				</div>
			</div>
		);
	}

	const statusIcon = () => {
		if (!progress) return <Film className='w-5 h-5 text-primary' />;
		switch (progress.status) {
			case "preparing":
				return (
					<Spinner className='w-5 h-5 text-primary animate-spin' />
				);
			case "processing":
				return (
					<Clapperboard className='w-5 h-5 text-primary animate-pulse' />
				);
			case "concatenating":
				return <Film className='w-5 h-5 text-primary animate-pulse' />;
			case "rerendering":
				return (
					<RefreshCw className='w-5 h-5 text-primary animate-spin' />
				);
			case "done":
				return <CheckCircle2 className='w-5 h-5 text-green-500' />;
			case "error":
				return <AlertCircle className='w-5 h-5 text-destructive' />;
		}
	};

	if (isProcessing) {
		return (
			<div className='flex flex-col items-center justify-center p-4 gap-6 max-w-4xl w-full mx-auto h-full'>
				{ }
				<div className='w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center'>
					<Clapperboard className='w-10 h-10 text-primary animate-pulse' />
				</div>

				{ }
				<div className='text-center space-y-2'>
					<h2 className='text-xl font-bold'>
						Đang tạo video final...
					</h2>
					<p className='text-sm text-muted-foreground'>
						{progress?.detail || "Đang chuẩn bị..."}
					</p>
				</div>

				{ }
				{progress && (
					<div className='w-full max-w-md space-y-2'>
						<div className='flex items-center gap-2'>
							{statusIcon()}
							<span className='text-sm font-medium'>
								{progress.detail}
							</span>
						</div>
						<Progress
							value={progress.progress}
							className='w-full h-2'
						/>
						{progress.current !== undefined &&
							progress.total !== undefined && (
								<p className='text-xs text-muted-foreground text-center'>
									{progress.current} / {progress.total} đoạn
								</p>
							)}
					</div>
				)}

				{ }
				{progress?.status === "error" && (
					<div className='w-full max-w-md bg-destructive/10 border border-destructive/20 rounded-xl p-4'>
						<div className='flex items-center gap-2 text-sm text-destructive'>
							<AlertCircle className='w-4 h-4 shrink-0' />
							<span>{progress.detail}</span>
						</div>
					</div>
				)}
			</div>
		);
	}

	if (!hasExistingFinal) {
		return (
			<div className='flex flex-col items-center justify-center p-4 gap-6 max-w-lg w-full mx-auto h-full'>
				{ }
				<div className='w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center'>
					<Film className='w-10 h-10 text-primary' />
				</div>

				{ }
				<div className='text-center space-y-2'>
					<h2 className='text-xl font-bold'>Tạo video final</h2>
					<p className='text-sm text-muted-foreground'>
						Ghép video gốc với audio đã tạo, giữ nguyên chất lượng
						video ban đầu.
					</p>
				</div>

				{ }
				<Button className='w-full gap-2' onClick={handleStartCreate}>
					<Film className='w-4 h-4' />
					Bắt đầu tạo
				</Button>
			</div>
		);
	}

	return (
		<div className='flex flex-col items-center justify-center p-4 gap-6 max-w-2xl w-full mx-auto h-full'>

			{ }
			<div className='w-full bg-background rounded-xl overflow-hidden shadow-sm border border-border'>
				<div className='aspect-video relative'>
					{outputPath && <VideoPlayer src={outputPath} />}
				</div>
			</div>

			{ }
			<div className='w-full bg-background rounded-xl overflow-hidden shadow-sm border border-border p-4 space-y-3'>
				{ }
				<div className='space-y-2'>
					<p className='text-xs text-muted-foreground font-semibold uppercase tracking-wide'>
						Video Path
					</p>
					<p
						className='text-xs text-muted-foreground font-mono truncate break-words'
						title={outputPath || ""}
					>
						{outputPath || ""}
					</p>
				</div>

				{ }
				<div className='flex gap-2 pt-2'>
					<Button
						variant='secondary'
						className='gap-2 flex-1'
						onClick={handleOpenFolder}
					>
						<FolderOpen className='w-4 h-4' />
						Mở thư mục
					</Button>
					<Button
						variant='outline'
						className='gap-2 flex-1'
						onClick={handleStartCreate}
					>
						<RefreshCw className='w-4 h-4' />
						Tạo lại
					</Button>
					{onComplete && (
						<Button
							className='gap-2 flex-1 shadow-sm'
							onClick={onComplete}
						>
							<CheckCircle2 className='w-4 h-4' />
							Hoàn tất
						</Button>
					)}
				</div>
			</div>
		</div>
	);
};
