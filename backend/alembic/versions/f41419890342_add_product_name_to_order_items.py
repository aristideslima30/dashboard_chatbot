import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = 'f41419890342'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Adiciona coluna product_name à tabela order_items
    op.add_column('order_items', sa.Column('product_name', sa.String(), nullable=True))
    op.create_index(op.f('ix_order_items_product_name'), 'order_items', ['product_name'], unique=False)


def downgrade() -> None:
    # Remove coluna product_name da tabela order_items
    op.drop_index(op.f('ix_order_items_product_name'), table_name='order_items')
    op.drop_column('order_items', 'product_name')