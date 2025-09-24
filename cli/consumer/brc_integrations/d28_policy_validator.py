"""
D28 Policy Validator for Consumer CLI

Implements D28 policy validation for consumers to evaluate content readiness
according to their own policies. The /ready function validates content against
consumer-defined policies instead of CI/CD readiness checks.

Key Features:
- Consumer policy definition and management
- Content readiness validation against policies
- Policy-based content discovery filtering
- Evidence collection for policy decisions
"""

import json
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, asdict
from enum import Enum


class PolicyDecision(Enum):
    ALLOW = "allow"
    WARN = "warn"
    BLOCK = "block"


@dataclass
class ContentMetadata:
    """Content metadata for policy evaluation"""
    version_id: str
    content_hash: str
    classification: str
    schema_hash: Optional[str] = None
    mime_type: str = "application/octet-stream"
    ontology_tags: List[str] = None
    license: str = "commercial"
    pii_flags: List[str] = None
    geo_origin: str = "unknown"
    price: int = 0
    size: int = 0
    row_count: Optional[int] = None
    null_percentage: Optional[float] = None
    profile_hash: Optional[str] = None
    outlier_score: Optional[float] = None
    uniqueness_ratio: Optional[float] = None
    feature_set_id: Optional[str] = None
    split_tag: Optional[str] = None
    bias_score: Optional[float] = None
    drift_score: Optional[float] = None
    parent_model_id: Optional[str] = None
    anonymization_level: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    producer_id: Optional[str] = None
    confirmations: int = 0
    is_recalled: bool = False

    def __post_init__(self):
        if self.ontology_tags is None:
            self.ontology_tags = []
        if self.pii_flags is None:
            self.pii_flags = []
        if self.created_at is None:
            self.created_at = datetime.now(timezone.utc)


@dataclass
class PolicyConstraints:
    """D28 Policy constraints for consumer validation"""
    # SPV & Trust
    min_confs: Optional[int] = None
    allow_recalled: bool = True

    # Classification & Content
    classification_allow_list: Optional[List[str]] = None
    required_schema_hash: Optional[str] = None
    required_mime_types: Optional[List[str]] = None
    required_ontology_tags: Optional[List[str]] = None

    # Producer & Provenance
    producer_allow_list: Optional[List[str]] = None
    producer_block_list: Optional[List[str]] = None
    max_lineage_depth: Optional[int] = None
    required_ancestor: Optional[str] = None

    # Compliance & Legal
    license_allow_list: Optional[List[str]] = None
    pii_flags_block_list: Optional[List[str]] = None
    geo_origin_allow_list: Optional[List[str]] = None

    # Economics
    max_price_per_byte: Optional[float] = None
    max_total_cost_for_lineage: Optional[int] = None
    max_data_age_seconds: Optional[int] = None
    min_producer_uptime: Optional[float] = None
    requires_billing_account: bool = False

    # Quality & Data Profile
    min_row_count: Optional[int] = None
    max_row_count: Optional[int] = None
    max_null_value_percentage: Optional[float] = None
    required_distribution_profile_hash: Optional[str] = None
    max_outlier_score: Optional[float] = None
    min_uniqueness_ratio: Optional[float] = None

    # MLOps
    required_feature_set_id: Optional[str] = None
    requires_valid_split: bool = False
    max_bias_score: Optional[float] = None
    max_drift_score: Optional[float] = None
    required_parent_model_id: Optional[str] = None

    # Security
    block_if_in_threat_feed: bool = False
    min_anonymization_level: Optional[Dict[str, Any]] = None


@dataclass
class PolicyDefinition:
    """Consumer policy definition"""
    policy_id: str
    name: str
    description: str
    enabled: bool
    policy_json: PolicyConstraints
    created_at: datetime
    updated_at: datetime


@dataclass
class PolicyEvaluation:
    """Policy evaluation result"""
    decision: PolicyDecision
    reasons: List[str]
    warnings: List[str]
    evidence: Dict[str, Any]


class D28PolicyValidator:
    """D28 Policy Validator for Consumer CLI"""

    def __init__(self):
        self.policies: Dict[str, PolicyDefinition] = {}

    def create_policy(self, name: str, description: str,
                     policy_constraints: Dict[str, Any]) -> PolicyDefinition:
        """Create a new consumer policy"""
        policy_id = f"pol_{uuid.uuid4().hex[:8]}"

        # Convert dict to PolicyConstraints
        constraints = PolicyConstraints(**policy_constraints)

        policy = PolicyDefinition(
            policy_id=policy_id,
            name=name,
            description=description,
            enabled=True,
            policy_json=constraints,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )

        self.policies[policy_id] = policy
        return policy

    def update_policy(self, policy_id: str, **updates) -> PolicyDefinition:
        """Update existing policy"""
        if policy_id not in self.policies:
            raise ValueError(f"Policy not found: {policy_id}")

        policy = self.policies[policy_id]

        for key, value in updates.items():
            if hasattr(policy, key):
                setattr(policy, key, value)

        policy.updated_at = datetime.now(timezone.utc)
        return policy

    def delete_policy(self, policy_id: str) -> None:
        """Delete policy"""
        if policy_id not in self.policies:
            raise ValueError(f"Policy not found: {policy_id}")

        del self.policies[policy_id]

    def list_policies(self) -> List[PolicyDefinition]:
        """List all policies"""
        return list(self.policies.values())

    def get_policy(self, policy_id: str) -> Optional[PolicyDefinition]:
        """Get specific policy"""
        return self.policies.get(policy_id)

    def evaluate_ready(self, version_id: str, policy_id: str,
                      metadata: ContentMetadata) -> PolicyEvaluation:
        """
        Evaluate content readiness against consumer policy (D28 /ready endpoint)
        This replaces the CI/CD-style ready check with policy-based validation.
        """
        policy = self.policies.get(policy_id)
        if not policy:
            raise ValueError(f"Policy not found: {policy_id}")

        constraints = policy.policy_json
        decision = PolicyDecision.ALLOW
        reasons = []
        warnings = []
        evidence = {}

        # 1. SPV & Trust Checks
        if constraints.min_confs is not None:
            if metadata.confirmations < constraints.min_confs:
                reasons.append("POLICY.SPV.CONFS_TOO_LOW")
                evidence["confirmations"] = {
                    "required": constraints.min_confs,
                    "actual": metadata.confirmations
                }
                decision = PolicyDecision.BLOCK

        if not constraints.allow_recalled and metadata.is_recalled:
            reasons.append("POLICY.SPV.CONTENT_RECALLED")
            evidence["recalled"] = True
            decision = PolicyDecision.BLOCK

        # 2. Classification & Content Checks
        if constraints.classification_allow_list:
            if metadata.classification not in constraints.classification_allow_list:
                reasons.append("POLICY.CONTENT.CLASSIFICATION_NOT_ALLOWED")
                evidence["classification_mismatch"] = {
                    "required": constraints.classification_allow_list,
                    "actual": metadata.classification
                }
                decision = PolicyDecision.BLOCK

        if constraints.required_schema_hash:
            if metadata.schema_hash != constraints.required_schema_hash:
                reasons.append("POLICY.CONTENT.SCHEMA_MISMATCH")
                evidence["schema_mismatch"] = {
                    "required": constraints.required_schema_hash,
                    "actual": metadata.schema_hash
                }
                decision = PolicyDecision.BLOCK

        if constraints.required_mime_types:
            if metadata.mime_type not in constraints.required_mime_types:
                reasons.append("POLICY.CONTENT.MIME_NOT_ALLOWED")
                evidence["mime_type_mismatch"] = {
                    "required": constraints.required_mime_types,
                    "actual": metadata.mime_type
                }
                decision = PolicyDecision.BLOCK

        if constraints.required_ontology_tags:
            missing_tags = [tag for tag in constraints.required_ontology_tags
                          if tag not in metadata.ontology_tags]
            if missing_tags:
                reasons.append("POLICY.CONTENT.TAGS_MISSING")
                evidence["missing_ontology_tags"] = missing_tags
                decision = PolicyDecision.BLOCK

        # 3. Producer & Provenance Checks
        if constraints.producer_allow_list and metadata.producer_id:
            if metadata.producer_id not in constraints.producer_allow_list:
                reasons.append("POLICY.PRODUCER.NOT_ALLOWED")
                evidence["producer_not_allowed"] = {
                    "allowed": constraints.producer_allow_list,
                    "actual": metadata.producer_id
                }
                decision = PolicyDecision.BLOCK

        if constraints.producer_block_list and metadata.producer_id:
            if metadata.producer_id in constraints.producer_block_list:
                reasons.append("POLICY.PRODUCER.BLOCK_LISTED")
                evidence["producer_blocked"] = metadata.producer_id
                decision = PolicyDecision.BLOCK

        # 4. Compliance & Legal Checks
        if constraints.license_allow_list:
            if metadata.license not in constraints.license_allow_list:
                reasons.append("POLICY.COMPLIANCE.LICENSE_NOT_ALLOWED")
                evidence["license_mismatch"] = {
                    "required": constraints.license_allow_list,
                    "actual": metadata.license
                }
                decision = PolicyDecision.BLOCK

        if constraints.pii_flags_block_list:
            blocked_pii = [flag for flag in metadata.pii_flags
                         if flag in constraints.pii_flags_block_list]
            if blocked_pii:
                reasons.append("POLICY.COMPLIANCE.PII_BLOCKED")
                evidence["blocked_pii_flags"] = blocked_pii
                decision = PolicyDecision.BLOCK

        if constraints.geo_origin_allow_list:
            if metadata.geo_origin not in constraints.geo_origin_allow_list:
                reasons.append("POLICY.COMPLIANCE.GEO_NOT_ALLOWED")
                evidence["geo_origin_mismatch"] = {
                    "required": constraints.geo_origin_allow_list,
                    "actual": metadata.geo_origin
                }
                decision = PolicyDecision.BLOCK

        # 5. Economics Checks
        if constraints.max_price_per_byte and metadata.size > 0:
            price_per_byte = metadata.price / metadata.size
            if price_per_byte > constraints.max_price_per_byte:
                reasons.append("POLICY.ECON.PRICE_PER_BYTE_EXCEEDED")
                evidence["price_per_byte_exceeded"] = {
                    "limit": constraints.max_price_per_byte,
                    "actual": price_per_byte
                }
                decision = PolicyDecision.BLOCK

        if constraints.max_data_age_seconds and metadata.created_at:
            age_seconds = (datetime.now(timezone.utc) - metadata.created_at).total_seconds()
            if age_seconds > constraints.max_data_age_seconds:
                reasons.append("POLICY.ECON.DATA_TOO_OLD")
                evidence["data_age"] = {
                    "limit": constraints.max_data_age_seconds,
                    "actual": age_seconds
                }
                decision = PolicyDecision.BLOCK

        # 6. Quality & Data Profile Checks
        if constraints.min_row_count and metadata.row_count is not None:
            if metadata.row_count < constraints.min_row_count:
                reasons.append("POLICY.QA.ROWS_TOO_FEW")
                evidence["row_count_too_low"] = {
                    "minimum": constraints.min_row_count,
                    "actual": metadata.row_count
                }
                decision = PolicyDecision.BLOCK

        if constraints.max_row_count and metadata.row_count is not None:
            if metadata.row_count > constraints.max_row_count:
                reasons.append("POLICY.QA.ROWS_TOO_MANY")
                evidence["row_count_too_high"] = {
                    "maximum": constraints.max_row_count,
                    "actual": metadata.row_count
                }
                decision = PolicyDecision.BLOCK

        if constraints.max_null_value_percentage and metadata.null_percentage is not None:
            if metadata.null_percentage > constraints.max_null_value_percentage:
                reasons.append("POLICY.QA.NULL_PERCENT_EXCEEDED")
                evidence["null_percentage_exceeded"] = {
                    "limit": constraints.max_null_value_percentage,
                    "actual": metadata.null_percentage
                }
                decision = PolicyDecision.BLOCK

        if constraints.required_distribution_profile_hash:
            if metadata.profile_hash != constraints.required_distribution_profile_hash:
                reasons.append("POLICY.QA.PROFILE_HASH_MISMATCH")
                evidence["profile_hash_mismatch"] = {
                    "required": constraints.required_distribution_profile_hash,
                    "actual": metadata.profile_hash
                }
                decision = PolicyDecision.BLOCK

        if constraints.max_outlier_score and metadata.outlier_score is not None:
            if metadata.outlier_score > constraints.max_outlier_score:
                reasons.append("POLICY.QA.OUTLIER_TOO_HIGH")
                evidence["outlier_score_exceeded"] = {
                    "limit": constraints.max_outlier_score,
                    "actual": metadata.outlier_score
                }
                decision = PolicyDecision.BLOCK

        if constraints.min_uniqueness_ratio and metadata.uniqueness_ratio is not None:
            if metadata.uniqueness_ratio < constraints.min_uniqueness_ratio:
                reasons.append("POLICY.QA.UNIQUENESS_TOO_LOW")
                evidence["uniqueness_ratio_too_low"] = {
                    "minimum": constraints.min_uniqueness_ratio,
                    "actual": metadata.uniqueness_ratio
                }
                decision = PolicyDecision.BLOCK

        # 7. MLOps Checks
        if constraints.required_feature_set_id:
            if metadata.feature_set_id != constraints.required_feature_set_id:
                reasons.append("POLICY.MLOPS.FEATURE_SET_MISSING")
                evidence["feature_set_mismatch"] = {
                    "required": constraints.required_feature_set_id,
                    "actual": metadata.feature_set_id
                }
                decision = PolicyDecision.BLOCK

        if constraints.requires_valid_split:
            if not metadata.split_tag or metadata.split_tag not in ['train', 'val', 'test']:
                reasons.append("POLICY.MLOPS.SPLIT_INVALID")
                evidence["invalid_split"] = {
                    "required": ["train", "val", "test"],
                    "actual": metadata.split_tag
                }
                decision = PolicyDecision.BLOCK

        if constraints.max_bias_score and metadata.bias_score is not None:
            if metadata.bias_score > constraints.max_bias_score:
                reasons.append("POLICY.MLOPS.BIAS_TOO_HIGH")
                evidence["bias_score_exceeded"] = {
                    "limit": constraints.max_bias_score,
                    "actual": metadata.bias_score
                }
                decision = PolicyDecision.BLOCK

        if constraints.max_drift_score and metadata.drift_score is not None:
            if metadata.drift_score > constraints.max_drift_score:
                reasons.append("POLICY.MLOPS.DRIFT_TOO_HIGH")
                evidence["drift_score_exceeded"] = {
                    "limit": constraints.max_drift_score,
                    "actual": metadata.drift_score
                }
                decision = PolicyDecision.BLOCK

        if constraints.required_parent_model_id:
            if metadata.parent_model_id != constraints.required_parent_model_id:
                reasons.append("POLICY.MLOPS.PARENT_MODEL_MISMATCH")
                evidence["parent_model_mismatch"] = {
                    "required": constraints.required_parent_model_id,
                    "actual": metadata.parent_model_id
                }
                decision = PolicyDecision.BLOCK

        # Add evaluation metadata to evidence
        evidence["evaluation_metadata"] = {
            "policy_id": policy_id,
            "policy_name": policy.name,
            "version_id": version_id,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
            "constraints_checked": self._get_active_constraints(constraints)
        }

        return PolicyEvaluation(
            decision=decision,
            reasons=reasons,
            warnings=warnings,
            evidence=evidence
        )

    def create_example_consumer_policies(self) -> Dict[str, Dict[str, Any]]:
        """Create example consumer policies for different use cases"""
        return {
            # Conservative financial consumer
            "financial-conservative": {
                "min_confs": 12,
                "allow_recalled": False,
                "classification_allow_list": ["public", "commercial"],
                "required_mime_types": ["application/json", "text/csv"],
                "license_allow_list": ["commercial", "enterprise"],
                "pii_flags_block_list": ["has_customer_name", "has_ssn", "has_account_number"],
                "geo_origin_allow_list": ["US", "EU", "CA"],
                "max_price_per_byte": 0.1,
                "max_data_age_seconds": 3600,  # 1 hour
                "min_row_count": 10000,
                "max_null_value_percentage": 2.0,
                "max_outlier_score": 2.5,
                "min_uniqueness_ratio": 0.9,
                "block_if_in_threat_feed": True
            },

            # Research-focused consumer
            "research-focused": {
                "min_confs": 3,
                "classification_allow_list": ["public", "research", "academic"],
                "required_mime_types": ["application/json", "text/csv", "application/parquet"],
                "license_allow_list": ["research", "cc-by", "cc-by-sa", "open"],
                "max_price_per_byte": 0.01,
                "max_data_age_seconds": 86400 * 30,  # 30 days
                "min_row_count": 1000,
                "max_null_value_percentage": 10.0,
                "requires_valid_split": True,
                "max_bias_score": 0.3,
                "max_drift_score": 0.2
            },

            # ML/AI training consumer
            "ml-training": {
                "min_confs": 6,
                "classification_allow_list": ["public", "research", "commercial"],
                "required_mime_types": ["application/json", "text/csv", "application/parquet"],
                "license_allow_list": ["research", "commercial", "cc-by"],
                "max_price_per_byte": 0.05,
                "min_row_count": 50000,
                "max_null_value_percentage": 5.0,
                "min_uniqueness_ratio": 0.8,
                "requires_valid_split": True,
                "max_bias_score": 0.2,
                "max_drift_score": 0.15,
                "min_anonymization_level": {"type": "k-anon", "k": 3}
            },

            # General business consumer
            "business-general": {
                "min_confs": 3,
                "classification_allow_list": ["public", "commercial", "internal"],
                "license_allow_list": ["commercial", "business", "enterprise"],
                "max_price_per_byte": 0.2,
                "max_data_age_seconds": 86400 * 7,  # 7 days
                "max_null_value_percentage": 15.0,
                "min_producer_uptime": 95.0
            }
        }

    def _get_active_constraints(self, constraints: PolicyConstraints) -> List[str]:
        """Get list of active constraints for evidence"""
        active = []
        for field in constraints.__dataclass_fields__:
            value = getattr(constraints, field)
            if value is not None and value != [] and value != {} and value != False:
                active.append(field)
        return active

    def export_policy(self, policy_id: str) -> Dict[str, Any]:
        """Export policy as JSON"""
        policy = self.policies.get(policy_id)
        if not policy:
            raise ValueError(f"Policy not found: {policy_id}")

        return {
            "policy_id": policy.policy_id,
            "name": policy.name,
            "description": policy.description,
            "enabled": policy.enabled,
            "policy_json": asdict(policy.policy_json),
            "created_at": policy.created_at.isoformat(),
            "updated_at": policy.updated_at.isoformat()
        }

    def import_policy(self, policy_data: Dict[str, Any]) -> PolicyDefinition:
        """Import policy from JSON"""
        constraints = PolicyConstraints(**policy_data["policy_json"])

        policy = PolicyDefinition(
            policy_id=policy_data["policy_id"],
            name=policy_data["name"],
            description=policy_data["description"],
            enabled=policy_data.get("enabled", True),
            policy_json=constraints,
            created_at=datetime.fromisoformat(policy_data["created_at"]),
            updated_at=datetime.fromisoformat(policy_data["updated_at"])
        )

        self.policies[policy.policy_id] = policy
        return policy

    def health_check(self) -> Dict[str, Any]:
        """Health check for policy validator"""
        return {
            "component": "D28 Policy Validator",
            "status": "healthy",
            "active_policies": len(self.policies),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }