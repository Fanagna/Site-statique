import ResponsiveImage from './ResponsiveImage';

export default function ContentBlock({ block }) {
  switch (block.type) {
    case 'paragraph':
      return <p className="text-lg text-gray-700 leading-relaxed mb-6">{block.text}</p>;
    case 'heading':
      return <h3 className="text-2xl font-serif font-bold text-arina-dark mt-10 mb-4">{block.text}</h3>;
    case 'quote':
      return (
        <blockquote className="relative pl-6 border-l-4 border-arina-gold my-8">
          <p className="text-xl font-serif italic text-arina-dark mb-2 leading-relaxed">
            &laquo; {block.text} &raquo;
          </p>
          {block.author && (
            <footer className="text-sm text-arina-gray font-medium">— {block.author}</footer>
          )}
        </blockquote>
      );
    case 'image':
      return (
        <figure className="my-8">
          <ResponsiveImage
            src={block.src}
            alt={block.caption || ''}
            className="w-full rounded-2xl shadow-md"
            sizes="(min-width: 896px) 896px, 100vw"
          />
          {block.caption && (
            <figcaption className="text-center text-sm text-arina-gray mt-3 italic">{block.caption}</figcaption>
          )}
        </figure>
      );
    default:
      return null;
  }
}
