export interface RefusalVerb {
    name: string;
    pattern: string;
    description: string;
}

export interface RefusalList {
    verbs: RefusalVerb[];
}

export function assertVerbAllowed(command: string, args: string[]): void {
    // Mechanical refusal gate
    // Throws an error if the verb/args match the refusal list.
    const fullCmd = [command, ...args].join(' ');
    
    // Skeleton implementation. 
    // In future slices, this will load from refusal-list.json and evaluate patterns.
    console.log(`[Gate] Checking verb: ${command} with args:`, args);
}
