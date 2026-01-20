window.HELP_IMPROVE_VIDEOJS = false;

function applyAnonymousMode() {
    if (!window.ANONYMOUS_MODE) return;

    const moreWorks = document.getElementById('more-works-container');
    if (moreWorks) {
        moreWorks.style.display = 'none';
    }

    const authorList = document.getElementById('author-list');
    if (authorList) {
        authorList.textContent = 'Anonymous Authors';
    }

    const affiliation = document.getElementById('author-affiliation');
    if (affiliation) {
        affiliation.textContent = 'Anonymous Institution';
    }

    const paperFrame = document.getElementById('paper-frame');
    if (paperFrame) {
        paperFrame.src = 'static/pdfs/paper_rebuttal.pdf';
    }

    document.title = 'FruitTouch | Anonymous for Review';

    const titleMeta = document.querySelector('meta[name="title"]');
    if (titleMeta) {
        titleMeta.setAttribute('content', 'FruitTouch | Anonymous for Review');
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
        ogTitle.setAttribute('content', 'FruitTouch | Anonymous for Review');
    }

    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) {
        twitterTitle.setAttribute('content', 'FruitTouch | Anonymous for Review');
    }

    const citationTitle = document.querySelector('meta[name="citation_title"]');
    if (citationTitle) {
        citationTitle.setAttribute('content', 'FruitTouch: A Perceptive Gripper for Gentle and Scalable Fruit Harvesting');
    }

    const bibtexCode = document.getElementById('bibtex-code');
    if (bibtexCode) {
        bibtexCode.textContent = `@article{FruitTouch2025,
  title={FruitTouch: A Perceptive Gripper for Gentle and Scalable Fruit Harvesting},
  author={Anonymous Authors},
  journal={Under Review},
  year={2025}
}`;
    }

    const authorMeta = document.querySelector('meta[name="author"]');
    if (authorMeta) {
        authorMeta.setAttribute('content', 'Anonymous');
    }

    const articleAuthorMeta = document.querySelector('meta[property="article:author"]');
    if (articleAuthorMeta) {
        articleAuthorMeta.setAttribute('content', 'Anonymous');
    }

    document.querySelectorAll('meta[name="citation_author"]').forEach((meta) => {
        meta.setAttribute('content', 'Anonymous');
    });

    const citationPdf = document.querySelector('meta[name="citation_pdf_url"]');
    if (citationPdf) {
        citationPdf.setAttribute('content', 'static/pdfs/paper_rebuttal.pdf');
    }

    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
        try {
            const data = JSON.parse(script.textContent);
            if (data['@type'] === 'ScholarlyArticle') {
                data.author = [{ '@type': 'Person', name: 'Anonymous' }];
                data.publisher = { '@type': 'Organization', name: 'Under Review' };
                data.url = window.location.origin + window.location.pathname;
                data.citation = 'BIBTEX_CITATION_HERE';
                script.textContent = JSON.stringify(data, null, 2);
            }
        } catch (error) {
            console.warn('Failed to update anonymous JSON-LD metadata.', error);
        }
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('is-active');
    }
}

function closeModal(modal) {
    if (modal) {
        modal.classList.remove('is-active');
    }
}

document.addEventListener('click', function(event) {
    const trigger = event.target.closest('.js-download-trigger');
    if (trigger) {
        event.preventDefault();
        openModal(trigger.dataset.modal);
        return;
    }

    const closeTarget = event.target.closest('[data-modal-close]');
    if (closeTarget) {
        const modal = closeTarget.closest('.modal');
        closeModal(modal);
    }
});

// More Works Dropdown Functionality
function toggleMoreWorks() {
    const dropdown = document.getElementById('moreWorksDropdown');
    const button = document.querySelector('.more-works-btn');
    
    if (dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        button.classList.remove('active');
    } else {
        dropdown.classList.add('show');
        button.classList.add('active');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const container = document.querySelector('.more-works-container');
    const dropdown = document.getElementById('moreWorksDropdown');
    const button = document.querySelector('.more-works-btn');
    
    if (container && !container.contains(event.target)) {
        dropdown.classList.remove('show');
        button.classList.remove('active');
    }
});

// Close dropdown on escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const dropdown = document.getElementById('moreWorksDropdown');
        const button = document.querySelector('.more-works-btn');
        dropdown.classList.remove('show');
        button.classList.remove('active');
        document.querySelectorAll('.modal.is-active').forEach((modal) => {
            closeModal(modal);
        });
    }
});

// Copy BibTeX to clipboard
function copyBibTeX() {
    const bibtexElement = document.getElementById('bibtex-code');
    const button = document.querySelector('.copy-bibtex-btn');
    const copyText = button.querySelector('.copy-text');
    
    if (bibtexElement) {
        navigator.clipboard.writeText(bibtexElement.textContent).then(function() {
            // Success feedback
            button.classList.add('copied');
            copyText.textContent = 'Cop';
            
            setTimeout(function() {
                button.classList.remove('copied');
                copyText.textContent = 'Copy';
            }, 2000);
        }).catch(function(err) {
            console.error('Failed to copy: ', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = bibtexElement.textContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            button.classList.add('copied');
            copyText.textContent = 'Cop';
            setTimeout(function() {
                button.classList.remove('copied');
                copyText.textContent = 'Copy';
            }, 2000);
        });
    }
}

// Scroll to top functionality
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Show/hide scroll to top button
window.addEventListener('scroll', function() {
    const scrollButton = document.querySelector('.scroll-to-top');
    if (window.pageYOffset > 300) {
        scrollButton.classList.add('visible');
    } else {
        scrollButton.classList.remove('visible');
    }
});

// Video carousel autoplay when in view
function setupVideoCarouselAutoplay() {
    const carouselVideos = document.querySelectorAll('.results-carousel video');
    
    if (carouselVideos.length === 0) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;
            if (entry.isIntersecting) {
                // Video is in view, play it
                video.play().catch(e => {
                    // Autoplay failed, probably due to browser policy
                    console.log('Autoplay prevented:', e);
                });
            } else {
                // Video is out of view, pause it
                video.pause();
            }
        });
    }, {
        threshold: 0.5 // Trigger when 50% of the video is visible
    });
    
    carouselVideos.forEach(video => {
        observer.observe(video);
    });
}

$(document).ready(function() {
    // Check for click events on the navbar burger icon

    var options = {
		slidesToScroll: 1,
		slidesToShow: 1,
		loop: true,
		infinite: true,
		autoplay: true,
		autoplaySpeed: 5000,
    }

	// Initialize all div with carousel class
    var carousels = bulmaCarousel.attach('.carousel', options);
	
    bulmaSlider.attach();
    
    // Setup video autoplay for carousel
    setupVideoCarouselAutoplay();

    applyAnonymousMode();

})
