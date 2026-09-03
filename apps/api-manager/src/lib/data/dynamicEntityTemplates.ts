/**
 * Prefill templates for the Create Dynamic Entity form.
 *
 * A page anywhere in the stack can deep-link to
 * `/dynamic-entities/system/create?template=<key>` and the form is prefilled
 * with the template's values; the admin reviews and submits with their own
 * entitlements. Entity names must satisfy the form's naming rule
 * (lowercase letters, numbers, underscores).
 */
import portalPageEntity from "./portalPageEntity.json";

export interface DynamicEntityTemplate {
	entityName: string;
	description: string;
	/** Pretty-printed JSON with `properties` and `required`, as shown in the schema textarea. */
	schemaJson: string;
	hasPersonalEntity: boolean;
	hasPublicAccess: boolean;
	hasCommunityAccess: boolean;
	personalRequiresRole: boolean;
	/** OBP-API v6.0.0 auth_mode: UserOnly (default) | ApplicationOnly | UserOrApplication | UserAndApplication. */
	authMode?: string;
}

/** The App Studio pages entity, kept in one place: the API Manager bootstraps it from the same definition. */
const portalPageTemplate: DynamicEntityTemplate = {
	entityName: portalPageEntity.entity_name,
	description: portalPageEntity.schema.description,
	schemaJson: JSON.stringify({ properties: portalPageEntity.schema.properties, required: portalPageEntity.schema.required }, null, 2),
	hasPersonalEntity: portalPageEntity.has_personal_entity,
	hasPublicAccess: portalPageEntity.has_public_access,
	hasCommunityAccess: portalPageEntity.has_community_access,
	personalRequiresRole: portalPageEntity.personal_requires_role,
	authMode: portalPageEntity.auth_mode
};

export const dynamicEntityTemplates: Record<string, DynamicEntityTemplate> = {
	"obp-portal-page": portalPageTemplate,
	"training-progress": {
		entityName: "training_progress",
		description:
			"Per-user progress through the OBP training curriculum. Personal entity: each user records which topics they are interested in and have covered, plus notes.",
		schemaJson: `{
  "properties": {
    "section_id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100,
      "example": "api-portal",
      "description": "Curriculum section id (slug)"
    },
    "topic_id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200,
      "example": "managing-consents",
      "description": "Topic id within the section (slug)"
    },
    "interested": {
      "type": "boolean",
      "example": true,
      "description": "The user wants training on this topic"
    },
    "covered": {
      "type": "boolean",
      "example": false,
      "description": "The topic has been covered in training"
    },
    "notes": {
      "type": "string",
      "minLength": 0,
      "maxLength": 2000,
      "example": "Covered in session 2.",
      "description": "Free-text notes"
    }
  },
  "required": ["section_id", "topic_id"]
}`,
		hasPersonalEntity: true,
		hasPublicAccess: false,
		hasCommunityAccess: false,
		personalRequiresRole: false
	}
};
