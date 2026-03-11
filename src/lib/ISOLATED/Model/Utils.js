/**
 * UTILITAIRES XPATH
 */
const evaluateXPath = (path, contextNode) => {
    try {
        const doc = contextNode.ownerDocument || contextNode;
        const result = doc.evaluate(path, contextNode, null, XPathResult.ANY_TYPE, null);
        
        switch (result.resultType) {
            case XPathResult.STRING_TYPE: return result.stringValue;
            case XPathResult.NUMBER_TYPE: return result.numberValue;
            case XPathResult.BOOLEAN_TYPE: return result.booleanValue;
            case XPathResult.UNORDERED_NODE_ITERATOR_TYPE: {
                const nodes = [];
                let n;
                while (n = result.iterateNext()) nodes.push(n);
                return nodes;
            }
            case XPathResult.FIRST_ORDERED_NODE_TYPE: return result.singleNodeValue;
            default: return null;
        }
    } catch (e) {
        console.warn(`AriaML XPath Error: ${path}`, e);
        return null;
    }
};

/**
 * UTILITAIRE : xmlToJSON
 */
function xmlToJSON(node, isRoot = false) {
    let obj = {};
    if (!isRoot) {
        Array.from(node.attributes).forEach(attr => { obj[`@${attr.name}`] = attr.value; });
    }
    Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 1) {
            const key = child.nodeName;
            const value = (child.childElementCount > 0 || child.attributes.length > 0) 
                ? xmlToJSON(child, false) 
                : child.textContent;
            
            if (key === 'item') {
                if (!Array.isArray(obj)) obj = [];
                obj.push(value);
            } else {
                obj[key] = value;
            }
        }
    });
    return (Object.keys(obj).length === 0 && node.textContent && !Array.isArray(obj)) 
        ? node.textContent : obj;
}
