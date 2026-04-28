type PassengerDefinition = {
    id: string
    description: string,
    name: string,
    thumbnail: string,
    scale: number,
    activeColorId: number,
    colors: string[]
}

export async function LoadPassenger(path: string, id: string): Promise<PassengerDefinition> {
    const response = await fetch(path);
    
    if (!response.ok) {
        throw new Error(`Failed to load passenger definition from ${path}`);
    }

    const data = await response.json();
    const passenger = data.passengers.find((p: PassengerDefinition) => p.id === id);
    if (!passenger) {
        throw new Error(`Passenger with id ${id} not found in ${path}`);
    }

    return passenger as PassengerDefinition;
}
