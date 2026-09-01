/**
 * Prefill templates for the Create Dynamic Entity form.
 *
 * A page anywhere in the stack can deep-link to
 * `/dynamic-entities/system/create?template=<key>` and the form is prefilled
 * with the template's values; the admin reviews and submits with their own
 * entitlements. Entity names must satisfy the form's naming rule
 * (lowercase letters, numbers, underscores).
 */
export interface DynamicEntityTemplate {
	entityName: string;
	description: string;
	/** Pretty-printed JSON with `properties` and `required`, as shown in the schema textarea. */
	schemaJson: string;
	hasPersonalEntity: boolean;
	hasPublicAccess: boolean;
	hasCommunityAccess: boolean;
	personalRequiresRole: boolean;
}

export const dynamicEntityTemplates: Record<string, DynamicEntityTemplate> = {
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
