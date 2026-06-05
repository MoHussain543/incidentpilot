type ProductMarkProps = {
  animated?: boolean;
};

export default function ProductMark({ animated = false }: ProductMarkProps) {
  return (
    <span className="product-mark" aria-hidden="true">
      <span className="product-mark__core" />
      <span className={`product-mark__ring${animated ? " product-mark__ring--animated" : ""}`} />
    </span>
  );
}
