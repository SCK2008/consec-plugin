export interface Config {
  consec?: {
    /**
     * Base URL of the ConSec web UI, used for "View in ConSec" links.
     * @visibility frontend
     */
    baseUrl?: string;
    /**
     * Registry host for images derived from the JFrog Artifactory
     * annotations. Defaults to artifactory.bmc.com.
     * @visibility frontend
     */
    jfrogRegistry?: string;
    /**
     * ConSec API base URL (ending in /api/v1) the backend uses to start scans.
     */
    apiUrl?: string;
    /**
     * ConSec operator token the backend uses to start scans. Never sent to
     * the browser.
     * @visibility secret
     */
    scanToken?: string;
    /**
     * Skip TLS verification when the backend calls apiUrl. Local use only.
     */
    allowInsecureTls?: boolean;
  };
}
