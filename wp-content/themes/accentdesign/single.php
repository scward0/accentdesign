



<?php if ( have_posts() ) : while ( have_posts() ) : the_post(); ?>

  <?php if( get_the_post_thumbnail() ) : ?>
    <div class="container text-center" style='padding: 0 5% 0 5%;'>
      <div class="header-image">
        <?php get_header(); ?>
        <br><br><br><br><br><br><br><br>
        <br><br><br><br><br><br><br><br>
        <br><br><br><br><br><br><br><br>
        <h1><a href="<?php the_permalink(); ?>" style="color: white;"><?php the_title(); ?></a></h1>
        <p style="color: white;">

        </p>
        <br><br><br><br><br><br><br><br>
        <br><br><br><br><br><br><br><br>
        <br><br><br><br><br><br><br><br>
      </div>
    </div>
<?php endif; ?>

<!-- <?php the_post_thumbnail('large'); ?> -->

<?php endwhile; else : ?>

  <p><?php _e( 'Sorry, no pages found' ); ?></p>

<?php endif; ?>

<?php get_footer(); ?>
