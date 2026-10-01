import type { GlobalSettings } from "../../../shared/types";
import {
	DEFAULT_SESSION_STAT_FIELDS,
	SESSION_STAT_FIELDS,
	type SessionStatField,
} from "../../../shared/session-stats";
import type { TFunction } from "../../i18n";
import SettingsEntry from "./SettingsEntry";
import SettingsSection from "./SettingsSection";
import SettingsToggle from "./SettingsToggle";

export default function AgentRateLimitSettingsSection({
	t,
	globalSettings,
	onToggle,
	onSessionFieldsChange,
}: {
	t: TFunction;
	globalSettings: GlobalSettings;
	onToggle: (enabled: boolean) => void;
	onSessionFieldsChange: (fields: SessionStatField[]) => void;
}) {
	const trackingOn = globalSettings.agentRateLimitTracking !== false;
	const selected = new Set(globalSettings.usagePanelSessionFields ?? DEFAULT_SESSION_STAT_FIELDS);
	const toggleField = (field: SessionStatField, checked: boolean) => {
		const next = new Set(selected);
		if (checked) next.add(field);
		else next.delete(field);
		onSessionFieldsChange(SESSION_STAT_FIELDS.filter((f) => next.has(f)));
	};
	return (
		<SettingsSection title={t("settings.rateLimitTracking")} helpTopicId="settings.rate-limits">
			<SettingsEntry anchor="rate-limit-tracking">
				<div>
					<p className="text-fg-3 text-sm mb-3">
						{t("settings.rateLimitTrackingDesc")}
					</p>
					<SettingsToggle
						checked={trackingOn}
						ariaLabel={t("settings.rateLimitTracking")}
						onLabel={t("settings.on")}
						offLabel={t("settings.off")}
						onToggle={() =>
							onToggle(globalSettings.agentRateLimitTracking === false)
						}
					/>
				</div>
			</SettingsEntry>
			{trackingOn && (
				<SettingsEntry anchor="usage-panel-session-fields">
					<fieldset>
						<legend className="text-fg-2 text-sm font-medium mb-1">
							{t("settings.usagePanelSessionFields")}
						</legend>
						<p className="text-fg-3 text-sm mb-3">{t("settings.usagePanelSessionFieldsDesc")}</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
							{SESSION_STAT_FIELDS.map((field) => (
								<label key={field} className="flex items-center gap-2 text-sm text-fg-2 cursor-pointer">
									<input
										type="checkbox"
										checked={selected.has(field)}
										onChange={(event) => toggleField(field, event.target.checked)}
										className="h-4 w-4 accent-accent"
									/>
									{t(`settings.sessionField.${field}`)}
								</label>
							))}
						</div>
					</fieldset>
				</SettingsEntry>
			)}
		</SettingsSection>
	);
}
