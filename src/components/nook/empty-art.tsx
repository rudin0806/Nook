/** The drawing that stands in for an empty collection.
 *
 * Drawn from divs rather than an asset, so it follows the theme tokens and
 * there is nothing to load. The three kinds share one language — thin shapes in
 * the fill tone, one piece tinted with the point colour, a slight lean — so the
 * tabs look related without all showing the same picture, which is what the
 * shelf illustration was doing on all three.
 */
export function EmptyArt({ kind }: { kind: "books" | "questions" | "trash" }) {
  if (kind === "books")
    return (
      <div className="empty-art empty-books" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    );

  if (kind === "questions")
    return (
      <div className="empty-art empty-questions" aria-hidden="true">
        <i />
        <i />
        <i>
          <b />
          <b />
        </i>
      </div>
    );

  return (
    <div className="empty-art empty-trash" aria-hidden="true">
      <i className="empty-trash-lid" />
      <i className="empty-trash-body">
        <b />
        <b />
      </i>
    </div>
  );
}
