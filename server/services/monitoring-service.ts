import * as appInsights from 'applicationinsights';
import { azureConfig } from './azure-config';

export class MonitoringService {
    async initialize() {
        const connectionString = await azureConfig.getAppInsightsConnectionString();
        appInsights.setup(connectionString)
            .setAutoDependencyCorrelation(true)
            .setAutoCollectRequests(true)
            .setAutoCollectPerformance(true, true)
            .setAutoCollectExceptions(true)
            .setAutoCollectDependencies(true)
            .setAutoCollectConsole(true)
            .setUseDiskRetryCaching(true)
            .start();
    }

    trackEvent(name: string, properties?: { [key: string]: any }) {
        appInsights.defaultClient.trackEvent({ name, properties });
    }

    trackException(exception: Error) {
        appInsights.defaultClient.trackException({ exception });
    }

    trackMetric(name: string, value: number) {
        appInsights.defaultClient.trackMetric({ name, value });
    }
}

export const monitoringService = new MonitoringService();