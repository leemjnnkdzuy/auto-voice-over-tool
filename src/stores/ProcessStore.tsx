import {createContext, useContext, useState, ReactNode} from "react";

interface ProcessContextType {
	isProcessing: boolean;
	setIsProcessing: (value: boolean) => void;
}

export const ProcessContext = createContext<ProcessContextType>({
	isProcessing: false,
	setIsProcessing: () => {
		// No-op default for context.
	},
});

export const useProcessContext = () => useContext(ProcessContext);

export const ProcessProvider = ({children}: {children: ReactNode}) => {
	const [isProcessing, setIsProcessing] = useState(false);

	return (
		<ProcessContext.Provider value={{isProcessing, setIsProcessing}}>
			{children}
		</ProcessContext.Provider>
	);
};
