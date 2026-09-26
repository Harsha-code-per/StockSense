"""The rich demo loader must leave a consistent, protected database."""

from sqlalchemy import text

from app.database import SessionLocal
from app.seed_demo import seed_demo
from app.services import count_priority_service, dashboard_service, inventory_service


def test_demo_seed_is_consistent_and_tells_the_story():
    seed_demo()
    with SessionLocal() as db:
        assert inventory_service.integrity(db).ok  # re-dating touched timestamps only
        trigger = db.scalar(
            text("select tgenabled from pg_trigger where tgname = 'stock_ledger_append_only'")
        )
        assert trigger == "O"  # append-only guard re-enabled

        summary = dashboard_service.get_dashboard_summary(db)
        statuses = {i.sku: i.stock_status for i in summary.low_stock_items}
        assert statuses["STL001"] == "out"  # untouched for the live demo
        assert statuses["FLT001"] == "out" and statuses["BRG001"] == "low"

        activity = dashboard_service.get_activity(db, days=14)
        assert all(
            sum((d.receipt, d.delivery, d.transfer, d.adjustment)) > 0 for d in activity.days
        )
        assert activity.pipeline.draft and activity.pipeline.waiting and activity.pipeline.ready

        top = count_priority_service.count_priority(db, limit=1)[0]
        assert (top.sku, top.level) == ("CHR001", "high")
        assert top.past_discrepancies >= 2
