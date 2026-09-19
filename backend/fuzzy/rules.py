"""Rule evaluation — Mamdani AND (min) of each rule's two antecedents.

Each of the 12 rules in config.RULES says: IF light IS <light-set> AND
delta IS <delta-set> THEN output IS <motor-set>. "AND" for Mamdani is
min() of the two membership degrees — the rule can only fire as strongly
as its weakest antecedent.
"""

from .config import RULES


def evaluate_rules(light_memberships, delta_memberships):
    """Return all 12 rules annotated with their activation degree (0..1).

    light_memberships / delta_memberships are the dicts fuzzify_light()
    and fuzzify_delta() return.
    """
    fired = []
    for rule in RULES:
        light_degree = light_memberships[rule["light"]]
        delta_degree = delta_memberships[rule["delta"]]
        activation = min(light_degree, delta_degree)
        fired.append({**rule, "activation": activation})
    return fired


def active_rules(light_memberships, delta_memberships):
    """Same as evaluate_rules(), but only the rules that actually fired."""
    return [r for r in evaluate_rules(light_memberships, delta_memberships) if r["activation"] > 0]
