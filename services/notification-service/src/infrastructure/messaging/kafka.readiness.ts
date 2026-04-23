type KafkaReadinessState = {
    consumerConnected: boolean;
    metadataVerified: boolean;
    lastError: string | null;
};

const state: KafkaReadinessState = {
    consumerConnected: false,
    metadataVerified: false,
    lastError: null,
};

export const markKafkaConsumerConnected = () => {
    state.consumerConnected = true;
    state.lastError = null;
};

export const markKafkaConsumerDisconnected = (reason?: string) => {
    state.consumerConnected = false;
    state.metadataVerified = false;
    state.lastError = reason ?? null;
};

export const markKafkaMetadataVerified = () => {
    state.metadataVerified = true;
    state.lastError = null;
};

export const getKafkaReadiness = () => ({
    ready: state.consumerConnected && state.metadataVerified,
    ...state,
});
